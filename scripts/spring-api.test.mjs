import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { join, resolve, dirname, basename } from 'node:path';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

let server, provider, base, storage, output = '';
const fixture = { fail: false, reject: false, requests: [], youtube: [], watch: 0 };
function embeddedJson(text) {
  const start = text.indexOf('{');
  for (let end = text.length; end > start; end--) {
    try { return JSON.parse(text.slice(start, end)); } catch { /* Prompt can have prose after the JSON. */ }
  }
  throw new Error('Structured context missing from prompt');
}
function candidate(name, ingredients, time, servings, cuisine, extra = {}) {
  return { name, subtitle: 'AI 시험 메뉴', category: '한 끼', reason: '입력 조건에 맞는 요리예요.', pair: '재료의 맛을 함께 즐겨요.',
    time, level: 0, cuisine, method: '볶음', ingredients: ingredients.map(([name, amount, unit]) => ({ name, amount: amount * servings / 2, unit })),
    prepTime: 3, restTime: 0, tools: [{ name: '팬', required: true }], tips: '중약불로 천천히 익혀요.', storage: '냉장 1일 보관해요.', ...extra,
    steps: [{ title: '준비', text: '재료를 손질해 준비하세요.', minutes: 3, heat: '불 사용 없음', technique: 'basic', passive: false },
      { title: '익히기', text: '재료를 넣어 중심까지 충분히 익히세요.', minutes: 7, heat: '중약불', technique: 'basic', passive: true }],
    swaps: [{ original: '토마토', name: '두부', amount: 100 * servings / 2, unit: 'g', note: '물기를 빼고 익히면 산미 대신 담백함이 더해져요.' }],
  };
}
before(async () => {
  storage = await mkdtemp(join(tmpdir(), 'hankki-test-'));
  provider = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const url = new URL(req.url, 'http://fixture');
    // Stand-ins for the YouTube web page, oEmbed and Data API v3, so tests never reach the real site.
    if (url.pathname === '/oembed') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ title: '시험 김치볶음밥 영상', author_name: '시험 요리 채널' })); return; }
    if (url.pathname === '/watch') { fixture.watch++; res.end('<script>var x={"shortDescription":"재료: 김치 1컵, 밥 2공기, 대파 1대\\\\n김치를 볶고 밥을 넣어 볶아요."};</script>'); return; }
    if (url.pathname.startsWith('/youtube/v3/')) {
      fixture.youtube.push(url.pathname + url.search);
      assert.equal(url.searchParams.get('key'), 'yt-key');
      const kind = url.pathname.split('/').pop();
      const video = id => ({ id, snippet: { title: `영상 ${id}`, channelTitle: '시험 요리 채널', channelId: 'UC' + 'a'.repeat(22), description: '재료: 김치 1컵, 밥 2공기', publishedAt: '2026-11-01T00:00:00Z', thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } } },
        statistics: { viewCount: id === 'bbbbbbbbbbb' ? '900' : '120', likeCount: '7' }, contentDetails: { duration: 'PT5M30S' } });
      const result = kind === 'search' ? { items: url.searchParams.get('type') === 'channel' ? [{ id: { channelId: 'UC' + 'a'.repeat(22) } }, { id: { channelId: 'UC' + 'b'.repeat(22) } }] : [{ id: { videoId: 'aaaaaaaaaaa' } }, { id: { videoId: 'bbbbbbbbbbb' } }] }
        : kind === 'videos' ? { items: url.searchParams.get('id').split(',').map(video) }
        : { items: url.searchParams.get('id').split(',').map((id, i) => ({ id, snippet: { title: `채널 ${i}`, customUrl: `@chan${i}`, thumbnails: { default: { url: 'https://yt3.example/c.jpg' } } }, statistics: { subscriberCount: String(1000 * (i + 1)), videoCount: '50' } })) };
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)); return;
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());
    fixture.requests.push(body);
    if (fixture.fail) { res.writeHead(503); res.end('{}'); return; }
    const schema = body.text.format.schema;
    const content = body.input[0].content;
    let result;
    if (schema.properties.reviews) {
      const context = embeddedJson(content[0].text);
      result = { reviews: context.recipes.map((r, index) => ({ index, valid: !fixture.reject, level: 0, reason: 'AI 독립 검토를 통과한 설명이에요.' })) };
    } else if (schema.properties.recipes) {
      const context = embeddedJson(content[0].text);
      const settings = context['설정'] || { servings: 2 };
      const cuisine = ['all', 'personal', undefined].includes(context['요리국가코드']) ? 'korean' : context['요리국가코드'];
      result = { recipes: [candidate('AI 시험 달걀 요리', [['달걀', 2, '개'], ['토마토', 1, '개'], ['식용유', 1, '큰술']], 10, settings.servings, cuisine, { calories: 320, cost: 2500, diet: ['채식', '없는표시'], allergens: ['난류'], tools: [{ name: '팬', required: true }, { name: '팬},{', required: false }] }),
        candidate('AI 시험 두부 요리', [['두부', 200, 'g'], ['브로콜리', 1, '개'], ['물', 50, 'ml']], 25, settings.servings, cuisine, { calories: 640, cost: 12000, diet: ['비건', '채식'], allergens: ['대두'] })] };
    } else if (schema.properties.ingredients) result = { ingredients: ['계란', '토마토'] };
    else if (schema.properties.explanation) result = { explanation: 'AI가 재료 조합의 이유를 설명했어요.' };
    else result = { title: 'AI 길라잡이 답변', message: '현재 조리 단계의 불 세기와 익힘 상태를 확인해주세요.' };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }));
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  const jars = (await readdir('build/libs')).filter(n => n.endsWith('.jar') && !n.endsWith('-plain.jar'));
  assert.equal(jars.length, 1);
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
  server = spawn(java, ['-jar', join('build/libs', jars[0]), '--server.port=0', '--OPENAI_API_KEY=fixture-key', '--AI_REQUESTS_PER_HOUR=36',
    `--OPENAI_BASE_URL=http://127.0.0.1:${provider.address().port}/v1`, `--COMMUNITY_STORAGE=${join(storage, 'community')}`, `--RECIPE_PHOTO_STORAGE=${join(storage, 'photos')}`, `--RECIPE_STATS_STORAGE=${join(storage, 'stats')}`,
    '--YOUTUBE_API_KEY=yt-key', `--YOUTUBE_BASE_URL=http://127.0.0.1:${provider.address().port}/youtube/v3`, `--YOUTUBE_WEB_URL=http://127.0.0.1:${provider.address().port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 30000);
    const read = chunk => { output += chunk.toString(); const match = output.match(/Tomcat started on port (\d+)/); if (match) { base = `http://127.0.0.1:${match[1]}`; clearTimeout(timer); resolve(); } };
    server.stdout.on('data', read); server.stderr.on('data', read);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}`)); });
  });
});
after(async () => {
  if (server && server.exitCode === null) await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
  if (provider) await new Promise(resolve => provider.close(resolve));
  if (storage) { assert.equal(dirname(resolve(storage)), resolve(tmpdir())); assert.ok(basename(storage).startsWith('hankki-test-')); await rm(storage, { recursive: true, force: true }); }
});
const post = (path, data) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const context = { mode: 'catalog', ingredients: [], pantry: [], excluded: [], level: 0, servings: 2, resultCount: 6, maxExtraIngredients: 2 };
const recommend = (change = {}) => post('/api/recommend', { ...context, ...change });

test('production UI is Expo and private/legacy files are not exposed', async () => {
  assert.match(await (await fetch(base)).text(), /_expo\/static\/js\/web/);
  for (const path of ['/.env', '/app.js', '/legacy-saved.json']) assert.equal((await fetch(base + path)).status, 404);
});
test('menu browsing calls AI generation and independent review, preserving AI order', async () => {
  const before = fixture.requests.length;
  const response = await recommend(); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.mode, 'ai');
  assert.deepEqual(result.recipes.map(r => r.name), ['AI 시험 달걀 요리', 'AI 시험 두부 요리']);
  assert.ok(result.recipes.every(r => r.source === 'ai' && r.id.startsWith('ai-')));
  assert.equal(fixture.requests.length - before, 2);
});
test('invalid filters, servings and recommendation preferences are rejected before AI calls', async () => {
  const before = fixture.requests.length;
  for (const change of [{ filter: 'unknown' }, { servings: 0 }, { servings: 7 }, { maxExtraIngredients: 11 }, { resultCount: 0 }]) assert.equal((await recommend(change)).status, 400);
  assert.equal(fixture.requests.length, before);
});
test('quick, ready and excluded ingredient constraints filter generated candidates', async () => {
  const quick = await (await recommend({ filter: 'quick' })).json(); assert.equal(quick.recipes.length, 1); assert.ok(quick.recipes.every(r => r.time <= 20));
  const ready = await (await recommend({ filter: 'ready', ingredients: ['달걀', '토마토'], pantry: ['식용유'] })).json(); assert.equal(ready.recipes.length, 1); assert.deepEqual(ready.recipes[0].missing, []);
  const excluded = await (await recommend({ excluded: ['달걀'] })).json(); assert.equal(excluded.recipes.length, 1); assert.equal(excluded.recipes[0].ingredients[0].name, '두부');
});
test('AI receives servings and schema count while configurable extra-ingredient limits are enforced', async () => {
  const one = await (await recommend({ resultCount: 1, servings: 4 })).json(); assert.equal(one.recipes.length, 1); assert.equal(one.recipes[0].ingredients[0].amount, 4);
  const strict = await (await recommend({ mode: 'ai', ingredients: ['달걀'], maxExtraIngredients: 0 })).json(); assert.deepEqual(strict.recipes, []);
  const allowed = await (await recommend({ mode: 'ai', ingredients: ['달걀'], maxExtraIngredients: 2 })).json(); assert.equal(allowed.recipes.length, 1);
});
test('AI substitution quantities are returned only for missing ingredients and owned replacements', async () => {
  const result = await (await recommend({ mode: 'ai', ingredients: ['달걀', '두부'], pantry: ['식용유'] })).json();
  const egg = result.recipes.find(r => r.name === 'AI 시험 달걀 요리'); assert.equal(egg.swaps[0].name, '두부'); assert.equal(egg.swaps[0].amount, 100);
  const blocked = await (await recommend({ mode: 'ai', ingredients: ['달걀', '두부'], pantry: ['식용유'], excluded: ['대두'] })).json();
  assert.ok(blocked.recipes.every(r => r.swaps.every(s => s.name !== '두부')));
});
test('AI failure or rejected review never returns a hardcoded menu', async () => {
  fixture.fail = true;
  try { const response = await recommend(); assert.equal(response.status, 502); assert.ok((await response.json()).error); } finally { fixture.fail = false; }
  fixture.reject = true;
  try { const result = await (await recommend()).json(); assert.equal(result.mode, 'ai'); assert.deepEqual(result.recipes, []); } finally { fixture.reject = false; }
});
test('guide questions and tutorial context reach AI without accepting executable actions', async () => {
  const response = await post('/api/guide', { event: 'question', question: '불을 얼마나 줄여야 하나요?', context: { screen: 'recipes', recipe: { name: '달걀 요리' }, cooking: { step: 1 } } });
  assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.title, 'AI 길라잡이 답변'); assert.equal(result.action, undefined); assert.equal(result.mood, undefined);
  assert.equal((await post('/api/guide', { event: 'tutorial', question: '', context: { tutorial: { id: 'ingredients' } } })).status, 200);
  assert.equal((await post('/api/guide', { event: 'question', question: '', context: {} })).status, 400);
});
test('Expo origin is allowed and unrelated origins are rejected', async () => {
  for (const [origin, expected] of [['http://localhost:8081', 200], ['https://unconfigured.example', 403]]) {
    const response = await fetch(`${base}/api/recommend`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } }); assert.equal(response.status, expected);
  }
});
test('situation filters, diet, lineups and search are validated and applied', async () => {
  const before = fixture.requests.length;
  for (const change of [{ theme: 'party' }, { diet: 'keto' }, { query: 'x'.repeat(61) }, { cuisine: 'mars' }]) assert.equal((await recommend(change)).status, 400);
  assert.equal(fixture.requests.length, before);
  assert.deepEqual((await (await recommend({ filter: 'ten' })).json()).recipes.map(r => r.name), ['AI 시험 달걀 요리']);
  assert.deepEqual((await (await recommend({ filter: 'light' })).json()).recipes.map(r => r.name), ['AI 시험 달걀 요리']);
  assert.equal((await (await recommend({ filter: 'thirty' })).json()).recipes.length, 2);
  assert.deepEqual((await (await recommend({ theme: 'budget' })).json()).recipes.map(r => r.name), ['AI 시험 달걀 요리']);
  assert.deepEqual((await (await recommend({ diet: 'vegan' })).json()).recipes.map(r => r.name), ['AI 시험 두부 요리']);
  const searched = await recommend({ cuisine: 'chinese', query: '마파두부', theme: 'seasonal' }); assert.equal(searched.status, 200);
  assert.match(fixture.requests.at(-2).input[0].content[0].text, /마파두부/);
  const recipe = (await searched.json()).recipes[0];
  assert.equal(recipe.cuisine, 'chinese'); assert.deepEqual(recipe.diet, ['채식']); assert.deepEqual(recipe.allergens, ['난류', '토마토']);
  assert.equal(recipe.calories, 320); assert.equal(recipe.steps[1].passive, true); assert.deepEqual(recipe.tools, [{ name: '팬', required: true }]);
});
test('recipes whose allergens match the exclusions are dropped', async () => {
  const result = await (await recommend({ excluded: ['토마토'] })).json();
  assert.ok(result.recipes.length > 0);
  assert.ok(result.recipes.every(r => !r.allergens.includes('토마토')));
});
test('views build rankings and reviews, reports are stored per recipe', async () => {
  const viewer = '22345678-1234-4234-8234-123456789abc', other = '32345678-1234-4234-8234-123456789abc';
  const [first, second] = (await (await recommend()).json()).recipes;
  assert.equal((await post(`/api/recipes/${second.id}/view`, { viewer })).status, 200);
  const blocked = await post(`/api/recipes/${second.id}/view`, { viewer: other });
  assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  const repeated = await (await fetch(`${base}/api/recipes/${second.id}`)).json(); assert.equal(repeated.views, 1);

  const ranking = await (await fetch(`${base}/api/rankings?period=today`)).json();
  assert.equal(ranking.rankings[0].recipe.id, second.id); assert.equal(ranking.rankings[0].views, 1);
  assert.equal((await fetch(`${base}/api/rankings?period=year`)).status, 400);
  assert.equal((await post(`/api/recipes/${first.id}/view`, { viewer: 'nope' })).status, 400);
  assert.equal((await post('/api/recipes/ai-00000000-0000-4000-8000-000000000000/view', { viewer })).status, 404);
  assert.equal((await post(`/api/recipes/${first.id}/reviews`, { viewer, author: '테스터', rating: 6, content: '' })).status, 400);
  await post(`/api/recipes/${second.id}/reviews`, { viewer, author: '테스터', rating: 3, content: '조금 짰어요' });
  const editedReview = await post(`/api/recipes/${second.id}/reviews`, { viewer, author: '테스터', rating: 5, content: '다시 해보니 맛있어요' });
  assert.equal(editedReview.status, 201);
  const replaced = await (await fetch(`${base}/api/recipes/${second.id}/reviews`)).json();
  assert.equal(replaced.reviewCount, 1); assert.equal(replaced.rating, 5); assert.equal(replaced.reviews[0].viewer, undefined);
  const sharedReview = await post(`/api/recipes/${second.id}/reviews`, { viewer: other, author: 'Other', rating: 3, content: '' });
  assert.equal(sharedReview.status, 201);
  const shared = await sharedReview.json();
  assert.equal(shared.reviewCount, 2); assert.equal(shared.rating, 4);
  assert.equal((await post(`/api/recipes/${first.id}/reports`, { viewer, reason: '분량이 이상해요', detail: '' })).status, 201);
  assert.equal((await post(`/api/recipes/${first.id}/reports`, { viewer, reason: '아무거나', detail: '' })).status, 400);
  assert.deepEqual((await (await fetch(`${base}/api/channels`)).json()).channels, []);
  assert.equal((await post('/api/video/analyze', { url: 'https://example.com/video' })).status, 400);
});
test('stored recipes can be browsed, searched, filtered and sorted without AI calls', async () => {
  await recommend();
  const before = fixture.requests.length;
  const get = async query => { const response = await fetch(`${base}/api/recipes?${query}`); assert.equal(response.status, 200); return response.json(); };
  const all = await get('size=40');
  assert.ok(all.total >= 2); assert.ok(all.recipes.every(r => r.recipe.id.startsWith('ai-') && typeof r.views === 'number'));
  assert.ok((await get('maxTime=10')).recipes.every(r => r.recipe.time <= 10));
  assert.ok((await get('q=두부')).recipes.every(r => r.recipe.name.includes('두부') || r.recipe.ingredients.some(i => i.name.includes('두부'))));
  const byTime = (await get('sort=time&size=40')).recipes.map(r => r.recipe.time);
  assert.deepEqual(byTime, [...byTime].sort((a, b) => a - b));
  assert.ok((await get('caloriesMax=500')).recipes.every(r => r.recipe.calories <= 500));
  const paged = await get('size=1&page=0'); assert.equal(paged.recipes.length, 1); assert.equal(paged.hasMore, true);
  for (const query of ['sort=random', 'size=41', 'cuisine=mars', 'source=web']) assert.equal((await fetch(`${base}/api/recipes?${query}`)).status, 400);
  assert.equal(fixture.requests.length, before);
});
test('YouTube search and channels come from the Data API with statistics', async () => {
  assert.equal((await (await fetch(base + '/api/status')).json()).youtubeEnabled, true);
  const videos = (await (await fetch(`${base}/api/youtube/videos?q=${encodeURIComponent('김치볶음밥')}`)).json()).videos;
  assert.deepEqual(videos.map(v => [v.id, v.views, v.seconds]), [['aaaaaaaaaaa', 120, 330], ['bbbbbbbbbbb', 900, 330]]);
  assert.ok(fixture.youtube.some(call => call.includes('q=%EA%B9%80%EC%B9%98%EB%B3%B6%EC%9D%8C%EB%B0%A5+%EB%A0%88%EC%8B%9C%ED%94%BC')));
  const calls = fixture.youtube.length;
  await fetch(`${base}/api/youtube/videos?q=${encodeURIComponent('김치볶음밥')}`);
  assert.equal(fixture.youtube.length, calls, 'repeated searches are served from the cache');
  const channels = (await (await fetch(`${base}/api/youtube/channels`)).json()).channels;
  assert.deepEqual(channels.map(c => c.subscribers), [2000, 1000]); assert.equal(channels[0].url, 'https://www.youtube.com/@chan1');
  assert.equal((await fetch(`${base}/api/youtube/videos?q=`)).status, 400);
});
test('a YouTube video becomes one reviewed catalog recipe, analysed only once', async () => {
  const watches = fixture.watch;
  const before = fixture.requests.length;
  const first = await (await post('/api/video/recipe', { url: 'https://youtu.be/ccccccccccc' })).json();
  assert.equal(first.reused, false); assert.equal(fixture.requests.length - before, 2);
  assert.equal(fixture.watch - watches, 1);
  const recipe = first.recipe;
  assert.equal(recipe.source, 'video'); assert.equal(recipe.video.id, 'ccccccccccc'); assert.equal(recipe.video.views, 120);
  assert.equal(recipe.photo.url, 'https://i.ytimg.com/vi/ccccccccccc/hqdefault.jpg'); assert.equal(recipe.photo.sourceUrl, 'https://www.youtube.com/watch?v=ccccccccccc');
  assert.match(fixture.requests.at(-2).input[0].content[0].text, /김치 1컵/);
  const again = await (await post('/api/video/recipe', { url: 'https://www.youtube.com/watch?v=ccccccccccc' })).json();
  assert.equal(again.reused, true); assert.equal(again.recipe.id, recipe.id); assert.equal(fixture.requests.length - before, 2);
  const listed = await (await fetch(`${base}/api/recipes?source=video`)).json();
  assert.deepEqual(listed.recipes.map(r => r.recipe.id), [recipe.id]);
  assert.equal((await post('/api/video/recipe', { url: 'https://example.com/v' })).status, 400);
});
test('community posting, likes and comments remain compatible', async () => {
  const viewer = '12345678-1234-4234-8234-123456789abc';
  const created = await (await post('/api/community/posts', { author: '테스터', title: '앱 연동 테스트', content: '오늘의 한 끼' })).json();
  const liked = await (await post(`/api/community/posts/${created.id}/like`, { viewer, liked: true })).json(); assert.equal(liked.likeCount, 1);
  const unliked = await post(`/api/community/posts/${created.id}/like`, { viewer, liked: false });
  assert.equal(unliked.status, 200); assert.equal((await unliked.json()).likeCount, 0);
  const other = '22345678-1234-4234-8234-123456789abc';
  const sharedLike = await post(`/api/community/posts/${created.id}/like`, { viewer: other, liked: true });
  assert.equal(sharedLike.status, 200); assert.equal((await sharedLike.json()).likeCount, 1);
  const commented = await (await post(`/api/community/posts/${created.id}/comments`, { viewer, author: '테스터', content: '맛있어요' })).json(); assert.equal(commented.commentCount, 1);
});

test('AI quota is shared across routes and ignores spoofed forwarded addresses', async () => {
  let response;
  for (let i = 0; i < 51; i++) {
    response = await fetch(base + '/api/explain', {method:'POST', headers:{'Content-Type':'application/json', 'X-Forwarded-For': '192.0.2.' + i}, body:'{}'});
    if (response.status === 429) break;
  }
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('retry-after')) > 60);
  assert.equal((await post('/api/recognize', {})).status, 429);
});
