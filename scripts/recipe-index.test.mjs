import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from './test-server.mjs';

test('SQL projection preserves filtering, deduplication, views and review updates across restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hankki-index-'));
  let server;
  const ids = [];
  try {
    await mkdir(join(directory, 'stats'));
    const now = Date.now();
    for (let i = 0; i < 120; i++) {
      const id = `ai-00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
      ids.push(id);
      const recipe = {
        id,
        name: `Dish ${String(i).padStart(3, '0')}`,
        menuKey: `dish-${Math.floor(i / 2)}`,
        cuisine: i % 2 ? 'korean' : 'western',
        time: i + 1,
        level: i % 3,
        calories: 100 + i,
        ingredients: [{ name: i % 2 ? 'Onion' : 'Tofu', amount: 1, unit: 'g' }],
      };
      const entry = {
        recipe,
        createdAt: new Date(now + i * 1000).toISOString(),
        views: i ? [now, now] : [now - 8 * 86400000],
        reviews: [],
        reports: [],
      };
      await writeFile(join(directory, 'stats', id + '.json'), JSON.stringify(entry));
    }
    server = await startTestServer(directory);
    const get = async (path) => {
      const response = await fetch(server.base + path);
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      return body;
    };
    const first = await get('/api/recipes?sort=latest&size=7');
    assert.equal(first.total, 60);
    assert.equal(first.recipes.length, 7);
    assert.equal(first.recipes[0].recipe.id, ids[119]);
    const next = await get('/api/recipes?sort=latest&size=7&page=1');
    assert.ok(
      next.recipes.every((row) => !first.recipes.some((old) => old.recipe.id === row.recipe.id)),
    );
    const filtered = await get(
      '/api/recipes?cuisine=korean&q=Onion&maxTime=20&level=1&caloriesMax=120&sort=time',
    );
    assert.ok(filtered.total > 0);
    assert.ok(
      filtered.recipes.every(
        (row) =>
          row.recipe.cuisine === 'korean' &&
          row.recipe.time <= 20 &&
          row.recipe.level === 1 &&
          row.recipe.calories <= 120,
      ),
    );
    // Wildcard-looking searches remain literal, not SQL LIKE expressions.
    assert.equal((await get('/api/recipes?q=%25')).total, 0);
    const viewer = '00000000-0000-4000-8000-000000000001';
    const post = (path, data) =>
      fetch(server.base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    assert.equal((await post(`/api/recipes/${ids[119]}/view`, { viewer })).status, 200);
    assert.equal(
      (
        await post(`/api/recipes/${ids[119]}/reviews`, {
          viewer,
          author: 'Tester',
          rating: 5,
          content: '',
        })
      ).status,
      201,
    );
    const rated = (await get('/api/recipes?sort=rating')).recipes[0];
    assert.equal(rated.recipe.id, ids[119]);
    assert.equal(rated.rating, 5);
    assert.equal(rated.views, 3);
    const rankings = await get('/api/rankings?period=week');
    assert.equal(rankings.rankings[0].recipe.id, ids[119]);
    assert.equal(rankings.rankings[0].views, 3);
    await server.stop();
    server = await startTestServer(directory);
    const restored = (await get('/api/recipes?sort=rating')).recipes[0];
    assert.equal(restored.recipe.id, ids[119]);
    assert.equal(restored.rating, 5);
    assert.equal(restored.views, 3);
  } finally {
    if (server) await server.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
