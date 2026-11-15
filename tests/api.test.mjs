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
