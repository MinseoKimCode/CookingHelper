import {randomUUID} from 'node:crypto';
import {mkdir, readFile, readdir, rename, unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const idPattern = /^\d{13}-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const viewerPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const sizes = {author:24, title:80, content:1200, comment:400, image:2*1024*1024};

function problem(status,message){
  return Object.assign(new Error(message),{status});
}

function requiredText(value,max,label){
  if(typeof value!=='string'||!value.trim()||value.trim().length>max){
    throw problem(400,`${label}을(를) 1~${max}자로 입력해주세요.`);
  }
  return value.trim();
}

function viewerId(value){
  if(typeof value!=='string'||!viewerPattern.test(value))throw problem(400,'이 브라우저의 식별자를 확인하지 못했어요. 새로고침해주세요.');
  return value;
}

function decodeImage(value){
  if(value==null||value==='')return null;
  const image=typeof value==='string'&&/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!image)throw problem(400,'JPG, PNG, WEBP 사진을 첨부해주세요.');
  const [mime,encoded]=image.slice(1);
  if(encoded.length>Math.ceil(sizes.image/3)*4)throw problem(413,'사진은 2MB 이하로 첨부해주세요.');
  const bytes=Buffer.from(encoded,'base64');
  if(bytes.length>sizes.image)throw problem(413,'사진은 2MB 이하로 첨부해주세요.');
  const valid=mime==='image/jpeg'?bytes.subarray(0,3).equals(Buffer.from([255,216,255])):
    mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
    bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid)throw problem(400,'사진을 읽을 수 없어요. 다른 파일을 선택해주세요.');
  return {mime,bytes};
}

function publicPost(post,viewer,includeComments=false){
  return {
    id:post.id, author:post.author, title:post.title, content:post.content, createdAt:post.createdAt, revision:post.revision,
    image:post.mime?`/api/community/posts/${post.id}/image`:null,
    liked:post.likes.includes(viewer), likeCount:post.likes.length,
    commentCount:post.comments.length,
    ...(includeComments?{comments:post.comments}:{})
  };
}

export function communityStore(directory){
  let writes=Promise.resolve();

  function update(action){
    const operation=writes.then(action);
    writes=operation.catch(()=>{});
    return operation;
  }

  async function getPost(id){
    if(!idPattern.test(id))throw problem(404,'게시글을 찾을 수 없어요.');
    try{
      return JSON.parse(await readFile(join(directory,id+'.json'),'utf8'));
    }catch(error){
      if(error.code==='ENOENT')throw problem(404,'게시글을 찾을 수 없어요.');
      throw error;
    }
  }

  async function savePost(post){
    const temporary=join(directory,post.id+'.'+randomUUID()+'.tmp');
    try{
      await writeFile(temporary,JSON.stringify(post),{flag:'wx'});
      await rename(temporary,join(directory,post.id+'.json'));
    }finally{
      await unlink(temporary).catch(()=>{});
    }
  }

  return {
    async feed(viewer,cursor){
      let files;
      try{files=await readdir(directory);}catch(error){
        if(error.code!=='ENOENT')throw error;
        files=[];
      }
      const ids=files.filter(file=>file.endsWith('.json')).map(file=>file.slice(0,-5))
        .filter(id=>idPattern.test(id)&&(!cursor||id<cursor)).sort().reverse();
      const posts=await Promise.all(ids.slice(0,20).map(getPost));
      return {posts:posts.map(post=>publicPost(post,viewer)),nextCursor:ids.length>20?posts.at(-1).id:null};
    },
    async post(id,viewer){
      return publicPost(await getPost(id),viewer,true);
    },
    create(data){
      const post={
        id:Date.now()+'-'+randomUUID(),
        author:requiredText(data?.author,sizes.author,'닉네임'),
        title:requiredText(data?.title,sizes.title,'제목'),
        content:requiredText(data?.content,sizes.content,'후기'),
        createdAt:new Date().toISOString(),comments:[],likes:[],revision:0
      };
      const image=decodeImage(data.image);
      post.mime=image?.mime;
      return update(async()=>{
        await mkdir(directory,{recursive:true});
        const photoPath=join(directory,post.id+'.image');
        if(image)await writeFile(photoPath,image.bytes,{flag:'wx'});
        try{
          await savePost(post);
        }catch(error){
          if(image)await unlink(photoPath).catch(()=>{});
          throw error;
        }
        return publicPost(post,null);
      });
    },
    async image(id){
      const post=await getPost(id);
      if(!post.mime)throw problem(404,'사진을 찾을 수 없어요.');
      return {mime:post.mime,bytes:await readFile(join(directory,id+'.image'))};
    },
    comment(id,data){
      const viewer=viewerId(data?.viewer);
      const item={
        id:randomUUID(),
        author:requiredText(data?.author,sizes.author,'닉네임'),
        content:requiredText(data?.content,sizes.comment,'댓글'),
        createdAt:new Date().toISOString()
      };
      return update(async()=>{
        const post=await getPost(id);
        post.comments.push(item);
        post.revision++;
        await savePost(post);
        return publicPost(post,viewer,true);
      });
    },
    like(id,data){
      const viewer=viewerId(data?.viewer);
      if(typeof data.liked!=='boolean')throw problem(400,'좋아요 상태를 확인해주세요.');
      return update(async()=>{
        const post=await getPost(id);
        const wasLiked=post.likes.includes(viewer);
        if(data.liked!==wasLiked){
          post.likes=data.liked?[...post.likes,viewer]:post.likes.filter(id=>id!==viewer);
          post.revision++;
          await savePost(post);
        }
        return publicPost(post,viewer,true);
      });
    }
  };
}

export function communityRoutes(store,{body,send}){
  return async (req,res,url)=>{
    if(!url.pathname.startsWith('/api/community/'))return false;
    const viewer=url.searchParams.get('viewer');
    if(req.method==='GET'&&url.pathname==='/api/community/posts'){
      send(res,200,await store.feed(viewer,url.searchParams.get('cursor')));
      return true;
    }
    const match=/^\/api\/community\/posts\/([^/]+)(?:\/(image|comments|like))?$/.exec(url.pathname);
    if(req.method==='GET'&&match?.[2]==='image'){
      const image=await store.image(match[1]);
      res.writeHead(200,{'Content-Type':image.mime,'Content-Length':image.bytes.length,
        'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400'});
      res.end(image.bytes);
      return true;
    }
    if(req.method==='GET'&&match&&!match[2]){
      send(res,200,await store.post(match[1],viewer));
      return true;
    }
    if(req.method==='POST'){
      if(req.headers['content-type']?.split(';')[0].trim()!=='application/json'){
        throw problem(415,'요청 형식이 올바르지 않아요.');
      }
      if(url.pathname==='/api/community/posts'){
        send(res,201,await store.create(await body(req)));
        return true;
      }
      if(match?.[2]==='comments'){
        send(res,201,await store.comment(match[1],await body(req)));
        return true;
      }
      if(match?.[2]==='like'){
        send(res,200,await store.like(match[1],await body(req)));
        return true;
      }
    }
    throw problem(404,'커뮤니티 경로를 찾을 수 없어요.');
  };
}
