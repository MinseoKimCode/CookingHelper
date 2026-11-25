const $=s=>document.querySelector(s);
const icon=name=>'<svg class="icon" aria-hidden="true"><use href="/icons.svg#'+name+'"></use></svg>';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let stored={};try{stored=JSON.parse(localStorage.getItem('hankki')||'{}');}catch{}
const state={ingredients:[],saved:Array.isArray(stored.saved)?stored.saved:[],savedRecipes:Array.isArray(stored.savedRecipes)?stored.savedRecipes:[],level:0,servings:2,excluded:[],results:[],filter:'all',view:'pantry',recipe:null,step:0,ai:false,context:null};
let timer=null,remaining=0,deadline=0,toastTimeout;
const assistantTasks=new Set();
let assistantReaction='',assistantReactionTimer,assistantListening=false;
let recipeMotionTimer,cookingMotionTimer;
const avatar=$('.app-header .assistant-avatar');

function updateAssistant(){
  if(assistantTasks.has('photo'))avatar.dataset.state='scanning';
  else if(assistantTasks.has('recipes'))avatar.dataset.state='thinking';
  else if(assistantReaction)avatar.dataset.state=assistantReaction;
  else if(state.view==='pantry'&&assistantListening)avatar.dataset.state='listening';
  else avatar.dataset.state='idle';
}

function setAssistantTask(task,active,reaction=''){
  clearTimeout(assistantReactionTimer);
  assistantReaction='';
  if(active){
    assistantTasks.add(task);
  }else{
    assistantTasks.delete(task);
    if(!assistantTasks.size&&reaction){
      assistantReaction=reaction;
      assistantReactionTimer=setTimeout(()=>{
        assistantReaction='';
        updateAssistant();
      },2200);
    }
  }
  updateAssistant();
}

setInterval(()=>{
  if(document.visibilityState!=='visible'||state.view!=='pantry'||avatar.dataset.state!=='idle')return;
  if($('#recipeDialog').open||$('#cookingDialog').open)return;
  assistantReaction='cooking';
  updateAssistant();
  assistantReactionTimer=setTimeout(()=>{
    assistantReaction='';
    updateAssistant();
  },2900);
},16000);

function showCookingMotion(){
  const mount=$('#cookingMascot');
  if(!mount)return;
  let mascot=mount.firstElementChild;
  if(!mascot){
    mascot=avatar.cloneNode(true);
    mount.append(mascot);
  }
  clearTimeout(cookingMotionTimer);
  mascot.dataset.state='cooking';
  cookingMotionTimer=setTimeout(()=>{mascot.dataset.state='idle';},2900);
}

$('#ingredientInput').addEventListener('focus',()=>{
  if(assistantReaction==='cooking'){
    clearTimeout(assistantReactionTimer);
    assistantReaction='';
  }
  assistantListening=true;
  updateAssistant();
});
$('#ingredientInput').addEventListener('blur',()=>{
  assistantListening=false;
  updateAssistant();
});

function persist(){try{localStorage.setItem('hankki',JSON.stringify({saved:state.saved,savedRecipes:state.savedRecipes}));}catch{toast('이 브라우저에서는 저장 공간을 사용할 수 없어요.');}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
async function request(path,data){const response=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const result=await response.json();if(!response.ok)throw new Error(result.error||'연결을 확인해주세요.');return result;}
function chips(){ $('#ingredients').innerHTML=state.ingredients.map((x,i)=>`<button class="chip" data-remove="${i}" aria-label="${escape(x)} 삭제">${escape(x)}${icon("x")}</button>`).join('');$('#ingredientCount').textContent=state.ingredients.length+'개';renderQuickIngredients();persist();}
function ingredientNames(text){return text.split(/[,，\n·]+/).map(x=>x.trim()).filter(x=>x&&x.length<=40);}
let ingredientsSubmitted=false;
function addIngredients(text){
  const names=ingredientNames(text);
  if(!names.length)return;
  const draft=ingredientsSubmitted?[]:state.ingredients;
  state.ingredients=[...new Set([...draft,...names])].slice(0,60);
  ingredientsSubmitted=false;
  chips();
}
$('#ingredientForm').onsubmit=e=>{
  e.preventDefault();
  const input=$('#ingredientInput');
  const names=ingredientNames(input.value);
  if(!names.length&&!state.ingredients.length){
    toast('재료 이름을 입력하거나 사진을 첨부해주세요.');
    input.focus();
    return;
  }
  addIngredients(names.join(','));
  input.value='';
  input.blur();
  requestRecipes();
};
$('#ingredients').onclick=e=>{const b=e.target.closest('[data-remove]');if(b){ingredientsSubmitted=false;state.ingredients.splice(Number(b.dataset.remove),1);chips();}};
const quickIngredients=['달걀','토마토','대파','밥','김치','두부'];
function renderQuickIngredients(){
  $('#quickIngredients').innerHTML=quickIngredients.filter(name=>!state.ingredients.includes(name)).map(name=>
    '<button data-quick="'+name+'">'+icon('plus')+name+'</button>'
  ).join('');
}
$('#quickIngredients').onclick=e=>{const option=e.target.closest('[data-quick]');if(option)addIngredients(option.dataset.quick);};
document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{state.level=Number(b.dataset.level);document.querySelectorAll('[data-level]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});});
function servings(n){state.servings=Math.max(1,Math.min(6,state.servings+n));$('#servings').textContent=`${state.servings}인분`;}
$('#minus').onclick=()=>servings(-1);$('#plus').onclick=()=>servings(1);
function context(){return {cuisine:$('#mealCuisine').value,pantry:$('#pantryInput').value.split(/[,，]/).map(x=>x.trim()).filter(Boolean),mode:'ai',ingredients:[...state.ingredients],excluded:$('#excluded').value.split(/[,，]/).map(x=>x.trim()).filter(Boolean),level:state.level,servings:state.servings};}
let recentMenus=[];
try{recentMenus=JSON.parse(sessionStorage.getItem('recentMenus')||'[]');}catch{}
if(!Array.isArray(recentMenus))recentMenus=[];
function rememberMenus(recipes){
  recentMenus=[...new Set([...recipes.map(r=>r.name),...recentMenus])].slice(0,120);
  try{sessionStorage.setItem('recentMenus',JSON.stringify(recentMenus));}catch{}
}
function combineMenus(previous,incoming){
  const seen=new Set();
  return [...previous,...incoming].filter(recipe=>{
    const key=recipe.name.normalize('NFKC').replace(/\s+/g,'').toLowerCase();
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}
async function fetchMenus(settings,previous,append){
  const requestedCuisine=settings.mode==='catalog'?cuisine:(settings.cuisine||'all');
  const options=append?{more:true,cuisine:requestedCuisine,filter:state.filter,previousKeys:previous.map(r=>r.menuKey).filter(Boolean),recentMenus:[...new Set([...previous.map(r=>r.name),...recentMenus])].slice(0,120) }: {cuisine:requestedCuisine,filter:settings.mode==='catalog'?state.filter:'all'};
  for(let attempt=0;attempt<2;attempt++){
    const {recipes,message}=await request('/api/recommend',{...settings,...options});
    const known=new Set(previous.map(r=>r.name.normalize('NFKC').replace(/\s+/g,'')));
    const fresh=combineMenus([],recipes).filter(r=>!known.has(r.name.normalize('NFKC').replace(/\s+/g,'')));
    if(fresh.length||!append||attempt===1)return {fresh,message};
  }
}
$('#shuffleRecipes').onclick=async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  button.textContent='새 메뉴를 찾고 있어요…';
  try{
    const before=recipesForView().length;
    if(cuisine==='personal'){await search(false,true);}
    else{await loadCatalog(true);}
    if(state.view==='home'&&recipesForView().length>before)$('#cards').scrollIntoView({block:'start'});
  }finally{button.disabled=false;button.textContent='랜덤 메뉴 더 받기';}
};
let searchVersion=0;
const cuisineLabels={korean:'한식',western:'양식',japanese:'일식',other:'기타'};
let cuisine='all';
const catalogBySelection=new Map();
let catalogEmptyMessage='';
let catalog=[],catalogContext=null,catalogRequest=0,catalogLoading=false,catalogError=false;
async function search(initial=false,append=false){
  if(!(append?state.context?.ingredients:state.ingredients)?.length){
    if(initial){render();return false;}
    toast('재료를 하나 이상 입력해주세요.');
    $('#ingredientInput').focus();
    return false;
  }
  const version=++searchVersion;
  const button=$('#recommend');
  button.disabled=true;
  button.textContent='요리를 찾고 있어요…';
  $('#sendIngredients').disabled=true;
  try {
    if(!initial)await aiStatus;
    const c=append&&state.context?state.context:context();
    const previous=append?state.results:[];
    const {fresh,message}=await fetchMenus(c,previous,append);
    if(version!==searchVersion)return false;
    state.context=c;
    state.results=[...fresh,...previous];
    state.emptyMessage=message;
    if(append&&state.results.length===previous.length)toast(message||'새 메뉴가 없어요.');
    rememberMenus(fresh);
    render();
    return true;
  }catch(error){
    toast(error.message);
    return false;
  }finally{
    if(version===searchVersion){
      button.disabled=false;
      $('#sendIngredients').disabled=false;
      button.innerHTML='요리 추천받기 '+icon('arrow-right');
    }
  }
}
$('#recommend').onclick=()=>requestRecipes();

function addMessage(text, sender){
  const message=document.createElement('div');
  message.className='bubble '+(sender==='user'?'user-bubble':'assistant-bubble');
  message.textContent=text;
  $('#conversationLog').append(message);
  return message;
}

function guide(title,message){
  $('#guideTitle').textContent=title;
  $('#guideMessage').textContent=message;
}

async function requestRecipes(){
  if(!$('#mealCuisine').value){
    toast('먼저 한식, 양식, 일식 중 하나를 선택해주세요.');
    $('#mealCuisine').focus();
    return false;
  }
  if($('#sendIngredients').disabled)return false;
  if(!state.ingredients.length)return search();
  $('#pantryPanel').hidden=true;
  $('#pantryToggle').setAttribute('aria-expanded','false');
  $('.starter-actions').hidden=true;
  $('#homeGuide').hidden=true;
  setAttachmentTray(false);
  ingredientsSubmitted=true;
  addMessage(cuisineLabels[$('#mealCuisine').value]+' · '+state.ingredients.join(', '),'user');
  const reply=addMessage('이 재료로 만들 수 있는 요리를 찾고 있어요…','assistant');
  reply.scrollIntoView({block:'nearest'});
  clearTimeout(recipeMotionTimer);
  const motionStarted=performance.now();
  setAssistantTask('recipes',true);
  const found=await search();
  const reaction=found&&state.results.length?'happy':'puzzled';
  recipeMotionTimer=setTimeout(
    ()=>setAssistantTask('recipes',false,reaction),
    Math.max(0,2300-(performance.now()-motionStarted))
  );
  if(!found){
    reply.textContent='요리를 찾지 못했어요. 잠시 후 다시 시도해주세요.';
    guide('재료를 다시 보내볼까요?','입력한 재료를 확인하고 아래 보내기 버튼을 다시 눌러주세요.');
  }else if(!state.results.length){
    reply.textContent=state.emptyMessage||'조건에 맞는 메뉴가 없어요.';
    guide('재료나 요리 종류를 바꿔봐요','재료를 하나 더 적거나 다른 요리 종류를 선택해보세요.');
  }else{
    guide('추천한 요리를 살펴봐요','대화 속 레시피를 누르면 재료 분량과 조리 순서를 볼 수 있어요.');
    const recipes=state.results;
    const details=state.context;
    reply.textContent=recipes.length+'가지 요리를 찾았어요.';
    const link=document.createElement('button');
    link.type='button';
    link.className='chat-result';
    const featured=document.createElement('span');
    featured.className='chat-result-name';
    featured.textContent=recipes[0].name;
    const label=document.createElement('span');
    label.className='chat-result-label';
    label.textContent='추천 레시피 보기';
    const copy=document.createElement('span');
    copy.append(featured,label);
    link.innerHTML='<span class="chat-result-icon">'+recipeThumb(safeRecipe(recipes[0]))+'</span>';
    link.append(copy);
    link.insertAdjacentHTML('beforeend',icon('arrow-right'));
    link.onclick=()=>{
      state.results=recipes;
      state.context=details;
      selectCuisine('personal');
      selectFilter('all');
      $('#homeNav').click();
    };
    reply.append(link);
  }
  if(state.view==='pantry')reply.scrollIntoView({block:'nearest'});
  return found;
}

function setAttachmentTray(open){
  $('#attachmentTray').hidden=!open;
  $('#attachmentToggle').setAttribute('aria-expanded',String(open));
}

function openPhotoGuide(){
  setAttachmentTray(true);
  guide('사진에서 재료를 찾아볼게요','아래에서 카메라나 앨범을 선택하세요. 사진을 올린 뒤 인식된 재료를 확인할 수 있어요.');
}

$('#assistantHelp').onclick=()=>showView('pantry');
$('#chatPhoto').onclick=openPhotoGuide;
$('#chatExample').onclick=()=>{
  guide('가지고 있는 재료를 적어봐요','달걀, 밥처럼 쉼표로 나눠 적고, 요리 종류를 고른 뒤 보내기 버튼을 눌러주세요.');
  $('#ingredientInput').focus();
};
$('#homeGuide').onclick=e=>{
  const example=e.target.closest('[data-example]');
  if(example){
    $('#mealCuisine').value=example.dataset.mealCuisine;
    const input=$('#ingredientInput');
    input.value=example.dataset.example;
    guide('예시 재료를 넣어뒀어요','그대로 보내거나 재료를 바꿔보세요. 보내기 버튼을 누르면 이 재료로 요리를 찾아드려요.');
    input.focus();
  }
  const shortcut=e.target.closest('[data-home-shortcut]');
  if(shortcut)document.getElementById(shortcut.dataset.homeShortcut).click();
};
$('#attachmentToggle').onclick=()=>{
  if($('#attachmentTray').hidden)openPhotoGuide();
  else setAttachmentTray(false);
};
$('#pantryToggle').onclick=()=>{
  if(state.view!=='pantry')showView('pantry');
  const panel=$('#pantryPanel');
  panel.hidden=!panel.hidden;
  $('#pantryToggle').setAttribute('aria-expanded',String(!panel.hidden));
  if(!panel.hidden)panel.scrollIntoView({block:'nearest'});
};

function nav(){
  for(const [selector,view] of [['#pantryNav','pantry'],['#homeNav','home'],['#communityNav','community'],['#savedNav','saved']]){
    const active=state.view===view;
    const button=$(selector);
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  $('#savedCount').textContent=state.saved.length||'';
  $('#pantryView').hidden=state.view!=='pantry';
  $('#composerDock').hidden=state.view!=='pantry';
  $('#recipeView').hidden=state.view!=='home'&&state.view!=='saved';
  $('#communityView').hidden=state.view!=='community';
  $('.filters').hidden=state.view==='saved';
  $('#cuisineTabs').hidden=state.view!=='home';
}

function showView(view){
  state.view=view;
  updateAssistant();
  render();
  $('#workspace').scrollTop=0;
}

$('#pantryNav').onclick=()=>showView('pantry');
$('#communityNav').onclick=()=>{
  showView('community');
  document.dispatchEvent(new Event('community:open'));
};
$('#homeNav').onclick=()=>{
  showView('home');
  if(cuisine!=='personal'&&!catalogLoading&&(catalogError||JSON.stringify(context())!==JSON.stringify(catalogContext)))loadCatalog();
};
$('#savedNav').onclick=()=>{
  showView('saved');
  restoreSavedRecipes();
};

async function loadCatalog(append=false){
  const current=++catalogRequest;
  const settings=append&&catalogContext?catalogContext:context();
  const cacheKey=JSON.stringify([settings,cuisine,state.filter]);
  const cached=catalogBySelection.get(cacheKey);
  if(!append&&cached){catalog=cached;catalogContext=settings;catalogLoading=false;catalogError=false;render();return;}
  catalogLoading=true;
  catalogError=false;
  render();
  try{
    const previous=append?catalog:[];
    const {fresh,message}=await fetchMenus({...settings,mode:'catalog'},previous,append);
    if(current!==catalogRequest)return;
    catalog=[...fresh,...previous];
    catalogEmptyMessage=message;
    if(append&&catalog.length===previous.length)toast(message||'새 메뉴가 없어요.');
    rememberMenus(fresh);
    if(catalog.length){
      if(catalogBySelection.size>=24)catalogBySelection.delete(catalogBySelection.keys().next().value);
      catalogBySelection.set(cacheKey,catalog);
    }
    catalogContext=settings;
  }catch(error){
    if(current!==catalogRequest)return;
    if(!append)catalog=[];
    catalogError=true;
    toast(error.message);
  }finally{
    if(current===catalogRequest){
      catalogLoading=false;
      render();
    }
  }
}

function selectCuisine(value){
  cuisine=value;
  document.querySelectorAll('[data-cuisine]').forEach(button=>{
    const selected=button.dataset.cuisine===value;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}
document.querySelectorAll('[data-cuisine]').forEach(button=>button.onclick=()=>{
  if(cuisine===button.dataset.cuisine&&!catalogError)return;
  selectCuisine(button.dataset.cuisine);
  if(cuisine!=='personal'){catalog=[];loadCatalog();}
  else render();
});

function selectFilter(filter){
  state.filter=filter;
  $('#recipeFilter').value=filter;
}
$('#recipeFilter').onchange=event=>{
  selectFilter(event.target.value);
  if(cuisine!=='personal'&&state.view==='home'){catalog=[];loadCatalog();}else render();
};
function safeRecipe(recipe){return JSON.parse(JSON.stringify(recipe),(key,value)=>typeof value==='string'&&!['id','color'].includes(key)?escape(value):value);}
async function restoreSavedRecipes(){
  const missing=state.saved.filter(id=>!id.startsWith('ai-')&&!state.savedRecipes.some(recipe=>recipe.id===id));
  if(!missing.length)return;
  try{
    const legacy=await request('/legacy-saved.json');
    for(const recipe of legacy){
      if(state.saved.includes(recipe.id)&&!state.savedRecipes.some(saved=>saved.id===recipe.id))state.savedRecipes.push(recipe);
    }
    persist();
    render();
  }catch(error){toast(error.message);}
}

function recipesForView(){
  if(state.view==='saved')return state.savedRecipes.filter(recipe=>state.saved.includes(recipe.id));
  if(cuisine==='personal')return state.results;
  return catalog.filter(recipe=>cuisine==='all'||recipe.cuisine===cuisine);
}

function missingCount(recipe){
  return recipe.missing.length+(recipe.missingSeasonings?.length||0);
}

function render(){
  nav();
  const loadingCatalog=state.view==='home'&&cuisine!=='personal'&&catalogLoading;
  $('#recipeLoading').hidden=!loadingCatalog;
  $('#cards').setAttribute('aria-busy',String(loadingCatalog));
  if(state.view!=='home'&&state.view!=='saved')return;
  const saved=state.view==='saved';
  $('#shuffleRecipes').hidden=saved;
  const personalized=!saved&&cuisine==='personal';
  const rows=recipesForView().filter(recipe=>{
    if(saved)return true;
    if(state.filter==='ready')return missingCount(recipe)===0;
    if(state.filter==='quick')return recipe.time<=20;
    if(state.filter==='easy')return recipe.level===0;
    return true;
  });
  $('#resultsTitle').textContent=saved?'저장한 레시피':'추천 레시피';
  $('#modeBadge').hidden=!personalized||!state.context;
  $('#modeBadge').textContent=state.results.some(recipe=>recipe.source==='ai')?'AI 추천':'재료 기준';

  if(loadingCatalog&&!rows.length){
    $('#resultDescription').textContent='';
    $('#cards').replaceChildren();
    return;
  }

  $('#resultDescription').textContent=saved?'레시피 '+rows.length+'개':
    personalized?'보유 재료로 찾은 요리 '+rows.length+'가지':
    (cuisineLabels[cuisine]||'전체')+' 레시피 '+rows.length+'개';

  if(rows.length){
    $('#cards').innerHTML=rows.map(recipeCard).join('');
    return;
  }

  let heading='조건에 맞는 요리가 없어요';
  let message=catalogEmptyMessage||'필터를 바꾸거나 다른 카테고리를 살펴보세요.';
  if(saved){
    heading='저장한 레시피가 없어요';
    message='마음에 드는 레시피를 북마크해보세요.';
  }else if(personalized){
    heading='맞춤 레시피가 없어요';
    message=state.results.length?'선택한 필터에 맞는 메뉴가 없어요. 모든 조건을 선택해 보세요.':state.emptyMessage||'대화에서 보유 재료를 보내주세요.';
  }
  if(!saved&&!personalized&&catalogError){
    heading='레시피를 불러오지 못했어요';
    message='추천 또는 저장 탭을 다시 눌러주세요.';
  }
  const empty=document.createElement('div');
  empty.className='empty';
  const title=document.createElement('strong');
  title.textContent=heading;
  const text=document.createElement('p');
  text.textContent=message;
  empty.append(title,text);
  $('#cards').replaceChildren(empty);
}

function recipeThumb(recipe){
  return recipe.photo
    ? `<img class="recipe-thumb" src="${recipe.photo.url}" alt="" loading="lazy" decoding="async">`
    : icon('cooking-pot');
}

function recipeFigure(recipe){
  const photo=recipe.photo;
  if(!photo)return '';
  if(photo.generated){
    return `<figure class="recipe-figure"><img src="${photo.url}" alt="${recipe.name} 조리 예시" decoding="async"><figcaption>조리 예시 · AI 생성 이미지</figcaption></figure>`;
  }
  const license=photo.licenseUrl
    ? `<a href="${photo.licenseUrl}" target="_blank" rel="noopener">${photo.license}</a>`
    : photo.license;
  return `<figure class="recipe-figure"><img src="${photo.url}" alt="${recipe.name} 조리 예시" decoding="async"><figcaption><span>조리 예시 · 크기 조정</span> <a href="${photo.sourceUrl}" target="_blank" rel="noopener" title="${photo.title}">${photo.author} / Wikimedia Commons</a> · ${license}</figcaption></figure>`;
}

function recipeCard(raw){
  const r=safeRecipe(raw);
  const isSaved=state.saved.includes(r.id);
  const servings=r.servings||(state.view==='saved'?state.servings:state.context?.servings)||2;
  const needed=missingCount(r);
  const status=needed?'재료·양념 '+needed+'개 필요':icon('check')+'바로 조리 가능';
  const label=cuisineLabels[r.cuisine];
  return `<article class="recipe-card${needed?" recipe-card-needs":""}">
    <button type="button" class="recipe-open" data-open="${r.id}" aria-label="${r.name} 레시피 보기">
      <span class="recipe-icon-tile" aria-hidden="true">${recipeThumb(r)}</span>
      <span class="card-summary">
        <span class="card-title">${r.name}</span>
        <span class="card-meta">
          ${label?`<span>${label}</span>`:''}
          <span>${r.time}분</span>
          <span>${['초보','중급','고급'][r.level]}</span>
          <span>${servings}인분</span>
        </span>
        <span class="card-badge ${needed?'needs-ingredients':''}">${status}</span>
      </span>
    </button>
    <button type="button" class="save-button" data-save="${r.id}" aria-label="${r.name} ${isSaved?'저장 취소':'저장'}" aria-pressed="${isSaved}">${icon('bookmark')}</button>
  </article>`;
}

$('#cards').onclick=e=>{
  const save=e.target.closest('[data-save]');
  if(!save){
    const open=e.target.closest('[data-open]');
    if(open)openRecipe(open.dataset.open);
    return;
  }
  const id=save.dataset.save;
  if(state.saved.includes(id)){
    state.saved=state.saved.filter(savedId=>savedId!==id);
    state.savedRecipes=state.savedRecipes.filter(recipe=>recipe.id!==id);
  }else{
    const recipe=recipesForView().find(recipe=>recipe.id===id);
    if(!recipe)return;
    state.saved.push(id);
    state.savedRecipes=[...state.savedRecipes.filter(saved=>saved.id!==id),recipe];
  }
  persist();
  render();
};
async function openRecipe(id){try{const personalized=state.view==='home'&&cuisine==='personal';const c=(personalized?state.context:catalogContext)||context();const raw=recipesForView().find(recipe=>recipe.id===id);const r=raw?safeRecipe(raw):null;if(!r){toast('현재 재료 또는 제외 설정으로는 이 요리를 추천할 수 없어요. 재료를 확인해주세요.');return;}state.recipe=raw;state.recipeContext=structuredClone({...c,servings:raw.servings||c.servings});const list=r.ingredients.map(i=>`<li class="${i.owned?'':'missing'}"><span>${i.owned?'✓':'＋'} ${i.name}</span><span>${i.amount}${i.unit} ${i.owned?'':'· 추가 필요'}</span></li>`).join('');$('#recipeDetail').innerHTML=`<div class="detail-top"><span class="section-kicker">레시피 상세</span><button class="close" data-close="recipeDialog" aria-label="닫기">${icon("x")}</button></div><div class="detail-body"><h2>${r.name}</h2><p class="muted">${r.time}분 · ${['초보','중급','고급'][r.level]} · ${r.servings||c.servings}인분</p>${recipeFigure(r)}<div class="reason-box"><strong>이 재료들이 어울리는 이유</strong><p id="reasonText">${r.reason}</p>${state.ai&&r.source!=='ai'?'<button class="secondary" id="explain">AI에게 더 자세히 물어보기</button>':''}</div><h3>준비할 재료</h3><ul class="ingredient-list">${list}</ul><p class="detail-muted">양념: ${r.seasonings.length?r.seasonings.map(i=>`${i.name} ${i.amount}${i.unit}${r.missingSeasonings?.includes(i.name)?" · 추가 필요":""}`).join(", "):"없음"}</p>${r.missing.length?`<h3>부족한 재료와 대체 방법</h3><p class="detail-muted">추가 필요: ${r.missing.join(', ')}</p>${r.swaps.length?r.swaps.map(s=>`<p>${s.original} → ${s.name}<br><span class="detail-muted">${s.note}</span></p>`).join(''):'<p class="detail-muted">보유 재료에서 적절한 대체 재료를 찾지 못했어요. 해당 재료를 준비해주세요.</p>'}`:''}<h3>재료 궁합</h3><p class="detail-muted">${r.pair}</p><h3>조리 순서</h3><ol class="detail-steps">${r.steps.map(s=>`<li><strong>${s.title}</strong><p>${stepText(s,c.level)}</p><small>${s.minutes}분 · ${s.heat}</small></li>`).join('')}</ol><p class="detail-muted">분량은 ${r.servings||c.servings}인분 기준이에요. 팬 크기와 인분에 따라 나누어 조리하고 익힘 상태를 확인하세요.</p><div class="detail-actions"><button class="primary" id="startCooking">요리 시작하기 →</button><button class="secondary" data-close="recipeDialog">목록으로</button></div></div>`;$('#recipeDialog').showModal();$('#startCooking').onclick=()=>{$('#recipeDialog').close();state.step=0;cook();$('#cookingDialog').showModal();};if($('#explain'))$('#explain').onclick=async e=>{const button=e.target;button.disabled=true;button.textContent='설명 준비 중…';try{const result=await request('/api/explain',{...state.recipeContext,id:r.id,name:raw.name,reason:raw.reason});if(state.recipe.id===r.id)$('#reasonText').textContent=result.explanation;}catch(e){toast(e.message);}finally{button.disabled=false;button.textContent='AI에게 더 자세히 물어보기';}};}catch(e){toast(e.message);}}
function stepText(s,level){return level===0?`${s.text} 시작하기 전에 필요한 재료를 손 닿는 곳에 준비하고, 시간보다 실제 익힘 상태를 확인해주세요.`:level===1?s.text:`${s.title} · ${s.heat}, 약 ${s.minutes}분. ${s.text.replace(/주세요/g,'주기').replace(/하세요/g,'하기').replace(/써세요/g,'썰기')}`;}
function stopTimer(){clearInterval(timer);timer=null;}
function timeText(){return `${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;}
function cook(){stopTimer();const r=safeRecipe(state.recipe),s=r.steps[state.step];remaining=s.minutes*60;$('#cookingDetail').innerHTML=`<div class="detail-top"><span class="section-kicker">${r.name}</span><span id="cookingMascot" aria-hidden="true"></span><button class="close" data-close="cookingDialog" aria-label="조리 모드 닫기">${icon("x")}</button></div><div class="detail-body"><div class="progress"><span style="width:${(state.step+1)/r.steps.length*100}%"></span></div><div class="step-number">STEP ${String(state.step+1).padStart(2,'0')} / ${String(r.steps.length).padStart(2,'0')}</div><h2>${s.title}</h2><div class="cook-meta"><span>${icon("clock-3")} 약 ${s.minutes}분</span><span>${icon("cooking-pot")} ${s.heat}</span></div><p class="cook-text">${stepText(s,state.recipeContext.level)}</p><details><summary>재료 분량 다시 보기</summary><p class="detail-muted">${[...r.ingredients,...r.seasonings].map(i=>`${i.name} ${i.amount}${i.unit}`).join(' · ')}</p></details><div class="timer"><output id="timerOutput">${timeText()}</output><button class="secondary" id="timerButton">타이머 시작</button></div><div class="detail-actions"><button class="secondary" id="prevStep" ${state.step===0?'disabled':''}>← 이전</button><button class="primary" id="nextStep">${state.step===r.steps.length-1?'요리 완성 ✓':'다음 단계 →'}</button></div></div>`;showCookingMotion();$('#prevStep').onclick=()=>{state.step--;cook();};$('#nextStep').onclick=()=>{if(state.step===r.steps.length-1){stopTimer();$('#cookingDialog').close();toast('오늘도 잘 챙겨 드세요. 맛있는 한 끼 완성!');}else{state.step++;cook();}};$('#timerButton').onclick=()=>{if(timer){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));stopTimer();$('#timerButton').textContent='이어서 시작';return;}if(remaining===0)remaining=s.minutes*60;showCookingMotion();deadline=Date.now()+remaining*1000;$('#timerButton').textContent='일시 정지';timer=setInterval(()=>{remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));$('#timerOutput').textContent=timeText();if(!remaining){stopTimer();$('#timerButton').textContent='다시 시작';toast('타이머가 끝났어요. 음식의 익힘 상태를 확인해주세요.');}},250);};}
document.addEventListener('click',e=>{const close=e.target.closest('[data-close]');if(close)document.getElementById(close.dataset.close).close();});$('#cookingDialog').addEventListener('close',()=>{stopTimer();clearTimeout(cookingMotionTimer);});
async function analyzePhoto(event){
  const picker=event.target;
  const file=picker.files[0];
  if(!file)return;
  if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){
    picker.value='';
    toast('JPG, PNG, WEBP 형식의 5MB 이하 사진을 선택해주세요.');
    return;
  }

  setAttachmentTray(false);
  const notice=$('#photoNotice');
  const review=$('#photoReview');
  notice.classList.remove('error');
  notice.textContent='사진 속 재료를 확인하고 있어요…';
  review.hidden=true;
  notice.scrollIntoView({block:'nearest'});
  setPhotoBusy(true);
  setAssistantTask('photo',true);
  let reaction='puzzled';

  try{
    const image=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error('사진을 열지 못했어요. 다시 선택해주세요.'));
      reader.readAsDataURL(file);
    });
    const data=await request('/api/recognize',{image});
    guide('사진 속 재료를 확인해요','잘못 읽은 재료는 아래에서 고치고, 요리 종류를 선택한 뒤 추천을 받아보세요.');
    review.innerHTML='<img alt="첨부한 냉장고 사진"><p>인식된 재료를 확인하고 수정해주세요.</p><input id="recognizedInput" aria-label="인식된 재료 수정"><button class="secondary" id="confirmPhoto">이 재료로 바로 요리 찾기</button><button class="secondary" id="cancelPhoto">취소</button>';
    review.querySelector('img').src=image;
    $('#recognizedInput').value=data.ingredients.join(', ');
    $('#confirmPhoto').onclick=async()=>{
      const names=ingredientNames($('#recognizedInput').value);
      if(!names.length){
        notice.textContent='재료를 하나 이상 확인해주세요.';
        return;
      }
      if($('#sendIngredients').disabled)return;
      if(!$('#mealCuisine').value){
        notice.textContent='요리 종류를 선택한 뒤 다시 눌러주세요.';
        $('#mealCuisine').focus();
        return;
      }
      state.ingredients=[];
      addIngredients(names.join(','));
      review.hidden=true;
      review.innerHTML='';
      notice.textContent='';
      await requestRecipes();
    };
    $('#cancelPhoto').onclick=()=>{
      review.hidden=true;
      review.innerHTML='';
      notice.textContent='사진 인식을 취소했어요.';
    };
    reaction=data.ingredients.length?'happy':'puzzled';
    notice.textContent=data.ingredients.length?'오인식된 재료는 수정하거나 지워주세요.':'확실한 재료를 찾지 못했어요. 직접 입력해주세요.';
    review.hidden=false;
    review.scrollIntoView({block:'nearest'});
  }catch(error){
    notice.classList.add('error');
    notice.textContent=error.message;
  }finally{
    setAssistantTask('photo',false,reaction);
    setPhotoBusy(false);
    picker.value='';
  }
}
function setPhotoBusy(busy){
  $('#takePhoto').disabled=busy;
  $('#selectPhoto').disabled=busy;
}
$('#takePhoto').onclick=()=>$('#cameraPhoto').click();
$('#selectPhoto').onclick=()=>$('#photo').click();
$('#cameraPhoto').onchange=analyzePhoto;
$('#photo').onchange=analyzePhoto;
const aiStatus=request('/api/status').then(s=>{state.ai=s.aiEnabled;}).catch(()=>toast('서버에 연결할 수 없어요. npm start로 실행해주세요.'));

chips();nav();render();

document.addEventListener('error',event=>{
  const image=event.target;
  if(!(image instanceof HTMLImageElement)||!image.getAttribute('src')?.startsWith('/api/recipe-photos/'))return;
  image.alt='AI 사진을 불러오지 못했어요';
  const caption=image.closest('figure')?.querySelector('figcaption');
  if(caption){
    const retry=document.createElement('button');
    retry.type='button';
    retry.textContent='AI 사진 다시 불러오기';
    retry.onclick=()=>{caption.textContent='조리 예시 · AI 생성 이미지';image.src=image.src.split('?')[0]+'?retry='+Date.now();};
    caption.replaceChildren(retry);
  }
},true);
