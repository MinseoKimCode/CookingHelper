import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {communityStore} from '../lib/community.mjs';

const directory=await mkdtemp(join(tmpdir(),'hankki-community-'));
process.env.NODE_ENV='test';
process.env.COMMUNITY_STORAGE=directory;
const {server}=await import('../server.mjs');
let base;
before(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}/api/community/posts`;
});
after(async()=>{
  await new Promise(resolve=>server.close(resolve));
  await rm(directory,{recursive:true,force:true});
});
const post=(suffix,data)=>fetch(base+suffix,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+rPuoAAAAASUVORK5CYII=';

test('서로 다른 방문자가 요리 사진을 보고 댓글과 좋아요를 남긴다',async()=>{
  const alice=randomUUID();
  const bob=randomUUID();
  const created=await post('',{author:'달걀요리사',title:'첫 오믈렛',content:'버섯을 넣었어요. 🥚',image});
  assert.equal(created.status,201);
  const entry=await created.json();
  const listing=await (await fetch(base+'?viewer='+bob)).json();
  assert.equal(listing.posts[0].content,'버섯을 넣었어요. 🥚');
  assert.ok(!('comments' in listing.posts[0]));
  const photo=await fetch(new URL(entry.image,base));
  assert.equal(photo.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()),Buffer.from(image.split(',')[1],'base64'));

  const suffix='/'+entry.id;
  const actions=await Promise.all([
    post(suffix+'/comments',{viewer:bob,author:'집밥친구',content:'내일 만들어 볼게요!'}),
    post(suffix+'/like',{viewer:bob,liked:true}),
    post(suffix+'/like',{viewer:bob,liked:true}),
    post(suffix+'/like',{viewer:alice,liked:true})
  ]);
  assert.ok(actions.every(response=>response.ok));

  const freshStore=communityStore(directory);
  const saved=await freshStore.post(entry.id,alice);
  assert.equal(saved.likeCount,2);
  assert.equal(saved.commentCount,1);
  assert.equal(saved.comments[0].author,'집밥친구');
  assert.equal(saved.liked,true);
  const undone=await (await post(suffix+'/like',{viewer:bob,liked:false})).json();
  assert.equal(undone.likeCount,1);
  assert.equal(undone.liked,false);
});

test('빈 제목, 올바르지 않은 사진 및 잘못된 게시글 경로를 거절한다',async()=>{
  assert.equal((await post('',{author:'한끼',title:'',content:'맛있어요'})).status,400);
  assert.equal((await post('',{author:'한끼',title:'제목',content:'맛있어요',image:'data:image/png;base64,aGVsbG8='})).status,400);
  assert.equal((await fetch(base+'/unknown/image')).status,404);
});
