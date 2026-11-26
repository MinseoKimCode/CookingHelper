// Explicit, opt-in live verification. Not included in npm test; makes paid API calls.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, dirname, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';

const directory = await mkdtemp(join(tmpdir(), 'hankki-live-'));
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
const child = spawn(java, ['-jar', 'build/libs/hankki.jar', '--server.port=0', '--OPENAI_BASE_URL=https://api.openai.com/v1', `--RECIPE_PHOTO_STORAGE=${join(directory, 'photos')}`, `--COMMUNITY_STORAGE=${join(directory, 'community')}`, `--RECIPE_STATS_STORAGE=${join(directory, 'stats')}`], { stdio: ['ignore', 'pipe', 'pipe'] });
try {
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Startup timeout')), 30000);
    let output = '';
    const read = chunk => { output += chunk.toString(); const port = output.match(/Tomcat started on port (\d+)/)?.[1]; if (port) { clearTimeout(timeout); resolve(`http://127.0.0.1:${port}`); } };
    child.stdout.on('data', read); child.stderr.on('data', read);
    child.once('error', e => { clearTimeout(timeout); reject(e); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}`)); });
  });
  assert.equal((await (await fetch(base + '/api/status')).json()).aiEnabled, true, 'Server AI key is not configured');
  const post = async (path, data) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(330000) });
    const result = await response.json();
    assert.equal(response.status, 200, result.error || 'AI response failed'); return result;
  };
  const guide = await post('/api/guide', { event: 'question', question: '달걀을 처음 볶을 때 불은 어떻게 조절하나요?', context: { screen: 'pantry', settings: { ingredients: ['달걀'], excluded: [], level: 0 } } });
  assert.ok(guide.title && guide.message);
  console.log(JSON.stringify({ check: 'live-guide', passed: true, title: guide.title }));
  const result = await post('/api/recommend', { mode: 'ai', ingredients: ['달걀', '토마토', '대파'], pantry: ['소금', '식용유', '물'], excluded: [], level: 0, servings: 2, cuisine: 'all', filter: 'ready', resultCount: 1, maxExtraIngredients: 0 });
  assert.equal(result.mode, 'ai'); assert.equal(result.recipes.length, 1); assert.deepEqual(result.recipes[0].missing, []);
  const recipe = result.recipes[0];
  console.log(JSON.stringify({ check: 'live-recommendation-and-review', passed: true, recipe: recipe.name, source: recipe.source }));
  // Detail fields are optional on the server, so report them for review instead of failing on a missing estimate.
  const details = ({ name, cuisine, time, prepTime, restTime, calories, cost, diet, allergens, tools, tips, storage, steps }) =>
    ({ name, cuisine, time, prepTime, restTime, calories, cost, diet, allergens, tools, tips, storage, passive: steps.map(s => `${s.title}:${s.passive}`) });
  console.log(JSON.stringify({ check: 'live-recipe-details', ...details(recipe) }, null, 1));
  assert.ok(Array.isArray(recipe.allergens) && recipe.allergens.includes('난류'), 'egg allergen should be marked');
  const budget = await post('/api/recommend', { mode: 'catalog', ingredients: [], pantry: [], excluded: [], level: 0, servings: 1, cuisine: 'snack', filter: 'all', theme: 'budget', diet: 'vegetarian', query: '간장 떡볶이', resultCount: 2, maxExtraIngredients: 2 });
  console.log(JSON.stringify({ check: 'live-budget-vegetarian-search', count: budget.recipes.length, message: budget.message, recipes: budget.recipes.map(details) }, null, 1));
  assert.ok(budget.recipes.every(r => r.cost <= 10000 && r.diet.some(t => t === '채식' || t === '비건')));
  const video = await post('/api/video/analyze', { url: 'https://www.youtube.com/watch?v=34BJfQ7fH9g' });
  console.log(JSON.stringify({ check: 'live-video-analysis', found: video.found, source: video.source, dish: video.dish, author: video.author, ingredients: video.ingredients.map(i => `${i.name} ${i.amount}${i.unit}`) }));
  const pasted = await post('/api/video/analyze', { url: 'https://www.youtube.com/watch?v=34BJfQ7fH9g', notes: '재료(2인분): 밥 2공기, 신김치 1컵, 대파 1대, 식용유 3큰술, 설탕 1/2큰술, 간장 1큰술, 달걀 2개. 대파를 기름에 볶아 파기름을 내고 김치를 볶은 뒤 밥을 넣어 볶아요.' });
  console.log(JSON.stringify({ check: 'live-video-pasted-notes', found: pasted.found, servings: pasted.servings, ingredients: pasted.ingredients.map(i => `${i.name} ${i.amount}${i.unit}`) }));
  assert.ok(pasted.found && pasted.ingredients.some(i => i.name.includes('김치')));
} finally {
  if (child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
  assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('hankki-live-'));
  await rm(directory, { recursive: true, force: true });
}
