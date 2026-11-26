import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, resolve, dirname, basename } from 'node:path';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// Test the packaged production server, without making paid AI requests.
let server, base, storage, output = '';
before(async () => {
  const jars = (await readdir('build/libs')).filter(name => name.endsWith('.jar') && !name.endsWith('-plain.jar'));
  assert.equal(jars.length, 1, 'Run gradlew.bat build first');
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
  storage = await mkdtemp(join(tmpdir(), 'hankki-test-'));
  server = spawn(java, ['-jar', join('build/libs', jars[0]), '--server.port=0', '--OPENAI_API_KEY=', `--COMMUNITY_STORAGE=${storage}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 30000);
    const read = chunk => {
      output += chunk.toString();
      const match = output.match(/Tomcat started on port (\d+)/);
      if (match) { base = `http://127.0.0.1:${match[1]}`; clearTimeout(timeout); resolve(); }
    };
    server.stdout.on('data', read);
    server.stderr.on('data', read);
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
});
after(async () => {
  if (server && server.exitCode === null) {
    await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
  }
  if (storage) {
    assert.equal(dirname(resolve(storage)), resolve(tmpdir()));
    assert.ok(basename(storage).startsWith('hankki-test-'));
    await rm(storage, { recursive: true, force: true });
  }
});
const request = data => fetch(`${base}/api/recommend`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});
const context = { mode: 'catalog', ingredients: [], pantry: [], excluded: [], level: 0, servings: 2 };

test('production server provides the UI and offline catalog', async () => {
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /_expo\/static\/js\/web/);
  for (const path of ['/.env', '/app.js', '/legacy-saved.json']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  const response = await request(context);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.mode, 'catalog');
  assert.ok(result.recipes.length > 0);
});
test('invalid filters and servings return 400', async () => {
  for (const change of [{ filter: 'unknown' }, { servings: 0 }, { servings: 7 }]) {
    assert.equal((await request({ ...context, ...change })).status, 400);
  }
});
test('quick and easy filters enforce their constraints', async () => {
  for (const filter of ['quick', 'easy']) {
    const result = await (await request({ ...context, filter })).json();
    assert.ok(result.recipes.length > 0);
    assert.ok(result.recipes.every(r => filter === 'quick' ? r.time <= 20 : r.level === 0));
  }
});
test('excluded ingredient is removed from catalog results', async () => {
  const catalog = await (await request(context)).json();
  const excluded = catalog.recipes[0].ingredients[0].name;
  const response = await request({ ...context, excluded: [excluded] });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.recipes.length > 0);
  assert.ok(result.recipes.length < catalog.recipes.length);
  assert.ok(result.recipes.every(r => [...r.ingredients, ...r.seasonings].every(i => i.name !== excluded)));
});
test('servings scale catalog ingredient quantities', async () => {
  const two = await (await request(context)).json();
  const four = await (await request({ ...context, servings: 4 })).json();
  for (const recipe of two.recipes) {
    const scaled = four.recipes.find(r => r.id === recipe.id);
    assert.equal(scaled.servings, 4);
    assert.equal(scaled.ingredients[0].amount, recipe.ingredients[0].amount * 2);
  }
});
test('Expo web origin is allowed, unconfigured origins are rejected', async () => {
  for (const [origin, expected] of [['http://localhost:8081', 200], ['https://unconfigured.example', 403]]) {
    const response = await fetch(`${base}/api/recommend`, { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type',
    } });
    assert.equal(response.status, expected);
    if (expected === 200) assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }
});
test('community posting, likes and comments use the mobile API contract', async () => {
  const post = async (path, data) => {
    const response = await fetch(`${base}/api/community/posts${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.ok(response.ok); return response.json();
  };
  const viewer = '12345678-1234-4234-8234-123456789abc';
  const created = await post('', { author: '테스터', title: '앱 연동 테스트', content: '오늘의 한 끼' });
  const liked = await post(`/${created.id}/like`, { viewer, liked: true });
  assert.equal(liked.likeCount, 1); assert.equal(liked.liked, true);
  const commented = await post(`/${created.id}/comments`, { viewer, author: '테스터', content: '맛있어요' });
  assert.equal(commented.commentCount, 1); assert.equal(commented.comments[0].content, '맛있어요');
  const feed = await (await fetch(`${base}/api/community/posts?viewer=${viewer}`)).json();
  assert.equal(feed.posts[0].id, created.id); assert.equal(feed.posts[0].liked, true);
});
