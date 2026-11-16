const $=s=>document.querySelector(s);
const icon=name=>'<svg class="icon" aria-hidden="true"><use href="/icons.svg#'+name+'"></use></svg>';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let stored={};try{stored=JSON.parse(localStorage.getItem('hankki')||'{}');}catch{}
const state={ingredients:Array.isArray(stored.ingredients)?stored.ingredients:[],saved:Array.isArray(stored.saved)?stored.saved:[],savedRecipes:Array.isArray(stored.savedRecipes)?stored.savedRecipes:[],level:0,servings:2,excluded:[],results:[],filter:'all',view:'pantry',recipe:null,step:0,ai:false,context:null};
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

function persist(){try{localStorage.setItem('hankki',JSON.stringify({ingredients:state.ingredients,saved:state.saved,savedRecipes:state.savedRecipes}));}catch{toast('이 브라우저에서는 저장 공간을 사용할 수 없어요.');}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
async function request(path,data){const response=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const result=await response.json();if(!response.ok)throw new Error(result.error||'연결을 확인해주세요.');return result;}
function chips(){ $('#ingredients').innerHTML=state.ingredients.map((x,i)=>`<button class="chip" data-remove="${i}" aria-label="${escape(x)} 삭제">${escape(x)}${icon("x")}</button>`).join('');$('#ingredientCount').textContent=state.ingredients.length+'개';renderQuickIngredients();persist();}
function ingredientNames(text){return text.split(/[,，\n·]+/).map(x=>x.trim()).filter(x=>x&&x.length<=40);}
function addIngredients(text){const names=ingredientNames(text);state.ingredients=[...new Set([...state.ingredients,...names])].slice(0,60);chips();}
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
$('#ingredients').onclick=e=>{const b=e.target.closest('[data-remove]');if(b){state.ingredients.splice(Number(b.dataset.remove),1);chips();}};
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
function context(){return {pantry:$('#pantryInput').value.split(/[,，]/).map(x=>x.trim()).filter(Boolean),mode:state.ai?'ai':'local',ingredients:[...state.ingredients],excluded:$('#excluded').value.split(/[,，]/).map(x=>x.trim()).filter(Boolean),level:state.level,servings:state.servings};}
let searchVersion=0;
const cuisineLabels={korean:'한식',western:'양식',japanese:'일식',other:'기타'};
let cuisine='all';
let catalog=[],catalogContext=null,catalogRequest=0,catalogLoading=false,catalogError=false;
async function search(initial=false){
  if(!state.ingredients.length){
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
    const c=context();
    if(initial)c.mode='local';
    const data=await request('/api/recommend',c);
    if(version!==searchVersion)return false;
    state.context=c;
    state.results=data.recipes;
    $('#modeBadge').textContent=data.mode==='ai'?'AI 추천':'샘플 레시피';
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

async function requestRecipes(){
  if($('#sendIngredients').disabled)return false;
  if(!state.ingredients.length)return search();
  $('#pantryPanel').hidden=true;
  $('#pantryToggle').setAttribute('aria-expanded','false');
  $('.starter-actions').hidden=true;
  setAttachmentTray(false);
  addMessage(state.ingredients.join(', '),'user');
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
  }else if(!state.results.length){
    reply.textContent='지금 재료로 추천할 수 있는 요리를 찾지 못했어요. 재료나 양념을 조금 더 알려주세요.';
  }else{
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
      $('#modeBadge').textContent=details.mode==='ai'?'AI 추천':'샘플 레시피';
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

$('#chatPhoto').onclick=()=>setAttachmentTray(true);
$('#chatExample').onclick=()=>$('#ingredientInput').focus();
$('#attachmentToggle').onclick=()=>setAttachmentTray($('#attachmentTray').hidden);
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
  if(cuisine!=='personal')loadCatalog();
};
$('#savedNav').onclick=()=>{
  showView('saved');
  loadCatalog();
};

async function loadCatalog(){
  const current=++catalogRequest;
  const settings=context();
  catalogLoading=true;
  catalogError=false;
  render();
  try{
    const result=await request('/api/recommend',{...settings,mode:'catalog'});
    if(current!==catalogRequest)return;
    catalog=result.recipes;
    catalogContext=settings;
  }catch(error){
    if(current!==catalogRequest)return;
    catalog=[];
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
  selectCuisine(button.dataset.cuisine);
  if(cuisine!=='personal'&&!catalogLoading&&(!catalogContext||catalogError))loadCatalog();
  else render();
});

function selectFilter(filter){
  state.filter=filter;
  document.querySelectorAll('[data-filter]').forEach(button=>{
    const selected=button.dataset.filter===filter;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}
document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{
  selectFilter(button.dataset.filter);
  render();
});
function safeRecipe(recipe){return JSON.parse(JSON.stringify(recipe),(key,value)=>typeof value==='string'&&!['id','color'].includes(key)?escape(value):value);}
function recipesForView(){
  if(state.view==='saved')return [...catalog,...state.savedRecipes].filter(recipe=>state.saved.includes(recipe.id));
  if(cuisine==='personal')return state.results;
  return catalog.filter(recipe=>cuisine==='all'||recipe.cuisine===cuisine);
}

function missingCount(recipe){
  return recipe.missing.length+(recipe.missingSeasonings?.length||0);
}

function render(){
  nav();
  if(state.view!=='home'&&state.view!=='saved')return;
  const saved=state.view==='saved';
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
  $('#modeBadge').textContent=state.context?.mode==='ai'?'AI 추천':'재료 기준';

  if(!personalized&&catalogLoading){
    $('#resultDescription').textContent='레시피를 불러오는 중이에요.';
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
  let message='필터를 바꾸거나 다른 카테고리를 살펴보세요.';
  if(saved){
    heading='저장한 레시피가 없어요';
    message='마음에 드는 레시피를 북마크해보세요.';
  }else if(personalized){
    heading='맞춤 레시피가 없어요';
    message='대화에서 보유 재료를 보내면 만들 수 있는 요리를 찾아드려요.';
  }
  if(!personalized&&catalogError){
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

$('#cards').onclick=e=>{const save=e.target.closest('[data-save]');if(save){const id=save.dataset.save;state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];const recipe=recipesForView().find(r=>r.id===id);if(state.saved.includes(id)&&recipe?.source==='ai')state.savedRecipes=[...state.savedRecipes.filter(r=>r.id!==id),recipe];state.savedRecipes=state.savedRecipes.filter(r=>state.saved.includes(r.id));persist();render();return;}const open=e.target.closest('[data-open]');if(open)openRecipe(open.dataset.open);};
async function openRecipe(id){try{const personalized=state.view==='home'&&cuisine==='personal';const c=(personalized?state.context:catalogContext)||context();const raw=recipesForView().find(recipe=>recipe.id===id);const r=raw?safeRecipe(raw):null;if(!r){toast('현재 재료 또는 제외 설정으로는 이 요리를 추천할 수 없어요. 재료를 확인해주세요.');return;}state.recipe=raw;state.recipeContext=structuredClone({...c,servings:raw.servings||c.servings});const list=r.ingredients.map(i=>`<li class="${i.owned?'':'missing'}"><span>${i.owned?'✓':'＋'} ${i.name}</span><span>${i.amount}${i.unit} ${i.owned?'':'· 추가 필요'}</span></li>`).join('');$('#recipeDetail').innerHTML=`<div class="detail-top"><span class="section-kicker">레시피 상세</span><button class="close" data-close="recipeDialog" aria-label="닫기">${icon("x")}</button></div><div class="detail-body"><h2>${r.name}</h2><p class="muted">${r.time}분 · ${['초보','중급','고급'][r.level]} · ${r.servings||c.servings}인분</p>${recipeFigure(r)}<div class="reason-box"><strong>이 재료들이 어울리는 이유</strong><p id="reasonText">${r.reason}</p>${state.ai&&r.source!=='ai'?'<button class="secondary" id="explain">AI에게 더 자세히 물어보기</button>':''}</div><h3>준비할 재료</h3><ul class="ingredient-list">${list}</ul><p class="detail-muted">양념: ${r.seasonings.length?r.seasonings.map(i=>`${i.name} ${i.amount}${i.unit}${r.missingSeasonings?.includes(i.name)?" · 추가 필요":""}`).join(", "):"없음"}</p>${r.missing.length?`<h3>부족한 재료와 대체 방법</h3><p class="detail-muted">추가 필요: ${r.missing.join(', ')}</p>${r.swaps.length?r.swaps.map(s=>`<p>${s.original} → ${s.name}<br><span class="detail-muted">${s.note}</span></p>`).join(''):'<p class="detail-muted">보유 재료에서 적절한 대체 재료를 찾지 못했어요. 해당 재료를 준비해주세요.</p>'}`:''}<h3>재료 궁합</h3><p class="detail-muted">${r.pair}</p><h3>조리 순서</h3><ol class="detail-steps">${r.steps.map(s=>`<li><strong>${s.title}</strong><p>${stepText(s,c.level)}</p><small>${s.minutes}분 · ${s.heat}</small></li>`).join('')}</ol><p class="detail-muted">분량은 ${r.servings||c.servings}인분 기준이에요. 팬 크기와 인분에 따라 나누어 조리하고 익힘 상태를 확인하세요.</p><div class="detail-actions"><button class="primary" id="startCooking">요리 시작하기 →</button><button class="secondary" data-close="recipeDialog">목록으로</button></div></div>`;$('#recipeDialog').showModal();$('#startCooking').onclick=()=>{$('#recipeDialog').close();state.step=0;cook();$('#cookingDialog').showModal();};if($('#explain'))$('#explain').onclick=async e=>{const button=e.target;button.disabled=true;button.textContent='설명 준비 중…';try{const result=await request('/api/explain',{...state.recipeContext,id:r.id});if(state.recipe.id===r.id)$('#reasonText').textContent=result.explanation;}catch(e){toast(e.message);}finally{button.disabled=false;button.textContent='AI에게 더 자세히 물어보기';}};}catch(e){toast(e.message);}}
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

chips();nav();search(true);
