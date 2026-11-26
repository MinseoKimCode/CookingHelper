import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';
const {server}=await import('../server.mjs');
let base;
before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(()=>new Promise(resolve=>server.close(resolve)));
const post=(route,data)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
test('홈과 프론트 파일을 제공한다',async()=>{for(const route of ['/','/app.js','/style.css'])assert.equal((await fetch(base+route)).status,200);});
test('실제 추천 API가 계란 동의어를 처리한다',async()=>{const res=await post('/api/recommend',{ingredients:['계란','토마토','대파'],level:0,servings:2});assert.equal(res.status,200);assert.equal((await res.json()).recipes[0].id,'tomato-egg');});
test('비정상 입력과 인분은 거절한다',async()=>{for(const data of [{ingredients:'달걀',level:0,servings:2},{ingredients:['달걀'],level:0,servings:99}])assert.equal((await post('/api/recommend',data)).status,400);});
test('사진이 아닌 데이터를 거절한다',async()=>assert.equal((await post('/api/recognize',{image:'file:///secret'})).status,400));
test('서버 파일을 정적 경로로 노출하지 않는다',async()=>assert.equal((await fetch(base+'/.env')).status,404));

test('카탈로그는 보유 재료 없이도 한식, 양식, 일식을 여러 개 제공한다',async()=>{
 const response=await post('/api/recommend',{mode:'catalog',ingredients:[],level:0,servings:2});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.mode,'catalog');
 for(const cuisine of ['korean','western','japanese']){
  assert.ok(result.recipes.filter(recipe=>recipe.cuisine===cuisine).length>=3);
 }
 assert.ok(result.recipes.every(recipe=>recipe.matched===0&&recipe.missing.length>0));
});

test('카탈로그에서 양념 보유 여부, 제외 재료 및 인분을 반영한다',async()=>{
 const context={mode:'catalog',ingredients:['밥'],pantry:['간장','식용유'],excluded:['우유'],level:0,servings:4};
 const result=await (await post('/api/recommend',context)).json();
 assert.equal(result.recipes[0].id,'yaki-onigiri');
 assert.equal(result.recipes[0].ingredients[0].amount,4);
 assert.deepEqual(result.recipes[0].missingSeasonings,[]);
 assert.ok(!result.recipes.some(recipe=>recipe.id==='potato-soup'));
 const partial=await (await post('/api/recommend',{...context,pantry:['식용유']})).json();
 assert.deepEqual(partial.recipes.find(recipe=>recipe.id==='yaki-onigiri').missingSeasonings,['간장']);
});

test('카탈로그 사진은 원본 출처와 함께 로컬 JPEG로 제공한다',async()=>{
 const result=await (await post('/api/recommend',{mode:'catalog',ingredients:[],level:0,servings:2})).json();
 const photos=result.recipes.flatMap(recipe=>recipe.photo?[recipe.photo]:[]);
 assert.equal(photos.length,13);
 for(const photo of photos){
  if(photo.url==='/recipe-images/tomato-egg-ai.jpg'){
   assert.equal(photo.generated,true);
  }else{
   assert.equal(new URL(photo.sourceUrl).hostname,'commons.wikimedia.org');
   assert.ok(photo.author&&photo.license);
  }
  const response=await fetch(base+photo.url);
  assert.equal(response.headers.get('content-type'),'image/jpeg');
  const bytes=new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0,3)],[255,216,255]);
 }
 assert.equal((await fetch(base+'/recipe-images/unknown.jpg')).status,404);
});

test('사진 인식과 AI 추천 API를 연결하고 보유하지 않은 재료를 제외한다', async () => {
 const originalFetch = globalThis.fetch;
 const originalKey = process.env.OPENAI_API_KEY;
 process.env.OPENAI_API_KEY = 'test-key';
 globalThis.fetch = async (url, options) => {
  if (url !== 'https://api.openai.com/v1/responses') return originalFetch(url, options);
  const request = JSON.parse(options.body);
  const recognizing = request.input[0].content.some(item => item.type === 'input_image');
  const recipe = {
   name:'달걀찜', subtitle:'부드러운 한 접시', category:'반찬', reason:'달걀을 촉촉하게 익혀요.', pair:'담백한 맛이에요.',
   time:10, level:0, ingredients:[{name:'달걀',amount:2,unit:'개'}],
   steps:[{title:'풀기',text:'달걀을 풀어주세요.',minutes:2,heat:'불 사용 없음'},
    {title:'익히기',text:'중심까지 충분히 익혀주세요.',minutes:8,heat:'약불'}]
  };
  const result = recognizing ? {ingredients:['계란']} : {recipes:[recipe,
   {...recipe,ingredients:[{name:'치즈',amount:1,unit:'장'}]}]};
  return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]}));
 };
 try {
  const recognized = await post('/api/recognize',{image:'data:image/png;base64,AAAA'});
  assert.deepEqual((await recognized.json()).ingredients,['달걀']);
  const response = await post('/api/recommend',{ingredients:['달걀'],pantry:[],excluded:[],level:0,servings:2,mode:'ai'});
  const result = await response.json();
  assert.equal(response.status,200);
  assert.equal(result.mode,'ai');
  assert.equal(result.recipes.length,1);
  assert.equal(result.recipes[0].name,'달걀찜');
 } finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
 }
});
