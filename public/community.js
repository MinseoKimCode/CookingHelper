(() => {
  const api='/api/community/posts';
  const feed=$('#communityFeed');
  const writer=$('#writePostDialog');
  const thread=$('#threadDialog');
  const postForm=$('#postForm');
  const commentForm=$('#commentForm');
  const postError=$('#postError');
  const commentError=$('#commentError');
  const photoInput=$('#postPhoto');
  const photoPreview=$('#postPhotoPreview');
  const posts=new Map();
  const busyLikes=new Set();
  let visiblePosts=[],cursor=null,feedVersion=0,threadVersion=0,photoVersion=0;
  let currentPost=null,attachment='',nickname='';
  const time=new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});

  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;
  bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  let viewer=hex.replace(/^(........)(....)(....)(....)(............)$/,'$1-$2-$3-$4-$5');
  try{
    viewer=localStorage.getItem('hankki.community.viewer')||viewer;
    nickname=localStorage.getItem('hankki.community.nickname')||'';
    localStorage.setItem('hankki.community.viewer',viewer);
  }catch{}

  function rememberAuthor(value){
    nickname=value;
    try{localStorage.setItem('hankki.community.nickname',value);}catch{}
  }

  function storePost(post){
    const previous=posts.get(post.id);
    if(!previous||post.revision>=previous.revision)posts.set(post.id,{...previous,...post});
  }

  function shortDate(value){return time.format(new Date(value));}
  function postUrl(id){return api+'/'+encodeURIComponent(id);}

  function renderFeed(emptyMessage='아직 게시글이 없어요. 첫 요리 후기를 남겨보세요.'){
    feed.innerHTML=visiblePosts.length?visiblePosts.map(id=>{
      const post=posts.get(id);
      const title=escape(post.title);
      return `<article class="community-card">
        <button type="button" class="community-open" data-thread="${post.id}" aria-label="${title} 보기">
          <span class="community-thumb">${post.image?`<img src="${escape(post.image)}" alt="" loading="lazy">`:icon('cooking-pot')}</span>
          <span class="community-card-copy">
            <strong>${title}</strong>
            <span class="community-excerpt">${escape(post.content)}</span>
            <span class="community-byline">${escape(post.author)} · ${shortDate(post.createdAt)}</span>
          </span>
        </button>
        <div class="community-card-actions">
          <button type="button" data-thread="${post.id}">${icon('message-circle')} 댓글 ${post.commentCount}</button>
          <button type="button" data-like="${post.id}" aria-label="${title} 좋아요 ${post.likeCount}개" aria-pressed="${post.liked}" ${busyLikes.has(id)?'disabled':''}>
            <span class="like-mark" aria-hidden="true">${post.liked?'♥':'♡'}</span> ${post.likeCount}
          </button>
        </div>
      </article>`;
    }).join(''):`<p class="empty">${escape(emptyMessage)}</p>`;
    $('#morePosts').hidden=!cursor;
  }

  async function loadFeed(next=false){
    const version=++feedVersion;
    const params=new URLSearchParams({viewer});
    if(next&&cursor)params.set('cursor',cursor);
    const status=$('#communityStatus');
    status.textContent='게시글을 불러오는 중이에요.';
    $('#refreshFeed').disabled=true;
    $('#morePosts').disabled=true;
    try{
      const result=await request(api+'?'+params);
      if(version!==feedVersion)return;
      result.posts.forEach(storePost);
      const ids=result.posts.map(post=>post.id);
      visiblePosts=next?[...new Set([...visiblePosts,...ids])]:ids;
      cursor=result.nextCursor;
      status.textContent='';
      renderFeed();
    }catch(error){
      if(version===feedVersion)status.textContent=error.message;
    }finally{
      if(version===feedVersion){
        $('#refreshFeed').disabled=false;
        $('#morePosts').disabled=false;
      }
    }
  }

  document.addEventListener('community:open',()=>loadFeed());
  $('#refreshFeed').onclick=()=>loadFeed();
  $('#morePosts').onclick=()=>loadFeed(true);

  function renderThread(){
    const post=posts.get(currentPost);
    if(!post)return;
    $('#threadTitle').textContent=post.title;
    $('#threadMeta').textContent=post.author+' · '+shortDate(post.createdAt);
    const image=$('#threadImage');
    image.hidden=!post.image;
    if(post.image)image.src=post.image;
    else image.removeAttribute('src');
    $('#threadText').textContent=post.content;
    const like=$('#threadLike');
    like.textContent=(post.liked?'♥':'♡')+' 좋아요 '+post.likeCount;
    like.setAttribute('aria-pressed',String(post.liked));
    like.disabled=busyLikes.has(post.id);
    $('#commentsTitle').textContent='댓글 '+post.commentCount;
    $('#commentsList').innerHTML=post.comments?.length?post.comments.map(comment=>
      `<article class="community-comment"><div><strong>${escape(comment.author)}</strong><span>${shortDate(comment.createdAt)}</span></div><p>${escape(comment.content)}</p></article>`
    ).join(''):'<p class="muted">첫 댓글을 남겨보세요.</p>';
    $('#threadContent').hidden=false;
  }

  async function openThread(id){
    const version=++threadVersion;
    currentPost=id;
    commentForm.reset();
    $('#commentAuthor').value=nickname;
    commentError.textContent='';
    $('#threadContent').hidden=true;
    $('#threadStatus').textContent='게시글을 여는 중이에요.';
    if(!thread.open)thread.showModal();
    try{
      const post=await request(postUrl(id)+'?'+new URLSearchParams({viewer}));
      if(version!==threadVersion)return;
      storePost(post);
      $('#threadStatus').textContent='';
      renderThread();
      renderFeed();
    }catch(error){
      if(version===threadVersion)$('#threadStatus').textContent=error.message;
    }
  }

  thread.addEventListener('close',()=>{
    threadVersion++;
    currentPost=null;
  });

  async function toggleLike(id){
    const post=posts.get(id);
    if(!post||busyLikes.has(id))return;
    busyLikes.add(id);
    renderFeed();
    if(currentPost===id)renderThread();
    try{
      storePost(await request(postUrl(id)+'/like',{viewer,liked:!post.liked}));
    }catch(error){
      if(thread.open)commentError.textContent=error.message;
      else toast(error.message);
    }finally{
      busyLikes.delete(id);
      renderFeed();
      if(currentPost===id)renderThread();
    }
  }

  feed.onclick=event=>{
    const like=event.target.closest('[data-like]');
    if(like)toggleLike(like.dataset.like);
    else {
      const opener=event.target.closest('[data-thread]');
      if(opener)openThread(opener.dataset.thread);
    }
  };
  $('#threadLike').onclick=()=>toggleLike(currentPost);

  commentForm.onsubmit=async event=>{
    event.preventDefault();
    const id=currentPost;
    if(!id)return;
    const data=Object.fromEntries(new FormData(commentForm));
    commentError.textContent='';
    const button=$('#sendComment');
    button.disabled=true;
    try{
      const post=await request(postUrl(id)+'/comments',{...data,viewer});
      storePost(post);
      rememberAuthor(data.author.trim());
      if(currentPost===id){
        $('#commentText').value='';
        renderThread();
        $('#commentsList').lastElementChild?.scrollIntoView({block:'nearest'});
      }
      renderFeed();
    }catch(error){
      if(currentPost===id)commentError.textContent=error.message;
    }finally{
      button.disabled=false;
    }
  };

  $('#writePost').onclick=()=>{
    if(!$('#postAuthor').value)$('#postAuthor').value=nickname;
    postError.textContent='';
    writer.showModal();
  };

  function resetPhoto(){
    photoVersion++;
    attachment='';
    photoInput.value='';
    photoPreview.hidden=true;
    photoPreview.querySelector('img').removeAttribute('src');
    $('#publishPost').disabled=false;
  }

  async function preparePhoto(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024){
      throw new Error('12MB 이하의 JPG, PNG 또는 WEBP 사진을 선택해주세요.');
    }
    const source=URL.createObjectURL(file);
    try{
      const image=new Image();
      image.src=source;
      await image.decode();
      const scale=Math.min(1,1440/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='white';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      return canvas.toDataURL('image/jpeg',.78);
    }finally{
      URL.revokeObjectURL(source);
    }
  }

  photoInput.onchange=async()=>{
    const file=photoInput.files[0];
    if(!file)return;
    const version=++photoVersion;
    postError.textContent='사진을 준비하는 중이에요.';
    $('#publishPost').disabled=true;
    try{
      const image=await preparePhoto(file);
      if(version!==photoVersion)return;
      attachment=image;
      photoPreview.querySelector('img').src=image;
      photoPreview.hidden=false;
      postError.textContent='';
    }catch(error){
      if(version===photoVersion){
        photoInput.value='';
        postError.textContent=error.name==='EncodingError'?'이 사진을 열지 못했어요. 다른 사진을 선택해주세요.':error.message;
      }
    }finally{
      if(version===photoVersion)$('#publishPost').disabled=false;
    }
  };

  $('#removePostPhoto').onclick=()=>{
    resetPhoto();
    postError.textContent='';
  };

  postForm.onsubmit=async event=>{
    event.preventDefault();
    const button=$('#publishPost');
    if(button.disabled)return;
    button.disabled=true;
    button.textContent='게시하는 중…';
    postError.textContent='';
    const data=Object.fromEntries(new FormData(postForm));
    try{
      const post=await request(api,{...data,image:attachment});
      rememberAuthor(data.author.trim());
      postForm.reset();
      resetPhoto();
      if(writer.open)writer.close();
      storePost(post);
      visiblePosts=[post.id,...visiblePosts.filter(id=>id!==post.id)];
      renderFeed();
      await loadFeed();
    }catch(error){
      postError.textContent=error.message;
    }finally{
      button.disabled=false;
      button.textContent='게시하기';
    }
  };
})();
