import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { join, resolve, dirname, basename } from 'node:path';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

let server, provider, base, storage, output = '';
const fixture = { fail: false, reject: false, requests: [] };
function embeddedJson(text) {
  const start = text.indexOf('{');
  for (let end = text.length; end > start; end--) {
    try { return JSON.parse(text.slice(start, end)); } catch { /* Prompt can have prose after the JSON. */ }
  }
  throw new Error('Structured context missing from prompt');
}
function candidate(name, ingredients, time, servings, cuisine) {
  return { name, subtitle: 'AI 시험 메뉴', category: '한 끼', reason: '입력 조건에 맞는 요리예요.', pair: '재료의 맛을 함께 즐겨요.',
    time, level: 0, cuisine, method: '볶음', ingredients: ingredients.map(([name, amount, unit]) => ({ name, amount: amount * servings / 2, unit })),
    steps: [{ title: '준비', text: '재료를 손질해 준비하세요.', minutes: 3, heat: '불 사용 없음', technique: 'basic' },
      { title: '익히기', text: '재료를 넣어 중심까지 충분히 익히세요.', minutes: 7, heat: '중약불', technique: 'basic' }],
    swaps: [{ original: '토마토', name: '두부', amount: 100 * servings / 2, unit: 'g', note: '물기를 빼고 익히면 산미 대신 담백함이 더해져요.' }],
  };
}
before(async () => {
  storage = await mkdtemp(join(tmpdir(), 'hankki-test-'));
  provider = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
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
      const settings = context['설정'];
      const cuisine = ['all', 'personal'].includes(context['요리국가코드']) ? 'korean' : context['요리국가코드'];
      result = { recipes: [candidate('AI 시험 달걀 요리', [['달걀', 2, '개'], ['토마토', 1, '개'], ['식용유', 1, '큰술']], 10, settings.servings, cuisine),
        candidate('AI 시험 두부 요리', [['두부', 200, 'g'], ['브로콜리', 1, '개'], ['물', 50, 'ml']], 25, settings.servings, cuisine)] };
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
  server = spawn(java, ['-jar', join('build/libs', jars[0]), '--server.port=0', '--OPENAI_API_KEY=fixture-key',
    `--OPENAI_BASE_URL=http://127.0.0.1:${provider.address().port}/v1`, `--COMMUNITY_STORAGE=${join(storage, 'community')}`, `--RECIPE_PHOTO_STORAGE=${join(storage, 'photos')}`], { stdio: ['ignore', 'pipe', 'pipe'] });
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
test('community posting, likes and comments remain compatible', async () => {
  const viewer = '12345678-1234-4234-8234-123456789abc';
  const created = await (await post('/api/community/posts', { author: '테스터', title: '앱 연동 테스트', content: '오늘의 한 끼' })).json();
  const liked = await (await post(`/api/community/posts/${created.id}/like`, { viewer, liked: true })).json(); assert.equal(liked.likeCount, 1);
  const commented = await (await post(`/api/community/posts/${created.id}/comments`, { viewer, author: '테스터', content: '맛있어요' })).json(); assert.equal(commented.commentCount, 1);
});
