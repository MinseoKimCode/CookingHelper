import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startTestServer } from './test-server.mjs';

test('legacy JSON migrates once; ownership, moderation and edits persist across restart', async () => {
  const storage = await mkdtemp(join(tmpdir(), 'hankki-management-'));
  const legacyId = '1000000000000-00000000-0000-4000-8000-000000000001';
  const recipeId = 'ai-00000000-0000-4000-8000-000000000002';
  const viewer = '00000000-0000-4000-8000-000000000003';
  const key = 'test-admin-key';
  let server;
  try {
    await mkdir(join(storage, 'community'));
    await mkdir(join(storage, 'stats'));
    const legacyFile = join(storage, 'community', legacyId + '.json');
    const raw = JSON.stringify({
      id: legacyId,
      title: 'Legacy',
      content: 'Original',
      author: 'Old',
      revision: 0,
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
    });
    await writeFile(legacyFile, raw);
    await writeFile(
      join(storage, 'stats', recipeId + '.json'),
      JSON.stringify({
        recipe: { id: recipeId, name: 'Legacy recipe' },
        createdAt: new Date().toISOString(),
        views: [],
        reviews: [],
        reports: [
          { reason: 'Old report', detail: '', viewer, createdAt: new Date().toISOString() },
        ],
      }),
    );
    server = await startTestServer(storage, [`--ADMIN_KEY=${key}`]);
    const get = (path) => fetch(server.base + path);
    const post = (path, data, admin = '') =>
      fetch(server.base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': admin },
        body: JSON.stringify(data),
      });
    const reports = async (admin = key) =>
      fetch(server.base + '/api/admin/reports', { headers: { 'X-Admin-Key': admin } });
    assert.equal((await (await get('/api/community/posts')).json()).posts[0].id, legacyId);
    assert.equal(
      (
        await post(`/api/community/posts/${legacyId}/edit`, {
          ownerToken: '0'.repeat(64),
          viewer,
          title: 'Forged',
          content: 'Forged',
        })
      ).status,
      403,
    );
    const created = await (
      await post('/api/community/posts', { author: 'Owner', title: 'New', content: 'Original' })
    ).json();
    assert.match(created.ownerToken, /^[0-9a-f]{64}$/);
    const path = `/api/community/posts/${created.id}`;
    const publicPost = await (await get(path)).json();
    assert.equal(publicPost.ownerToken, undefined);
    assert.equal(publicPost.ownerHash, undefined);
    assert.equal(
      (await post(path + '/edit', { viewer, title: 'Bad', content: 'Bad' })).status,
      403,
    );
    const edited = await post(path + '/edit', {
      viewer,
      ownerToken: created.ownerToken,
      title: 'Edited',
      content: 'Updated',
    });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).title, 'Edited');
    const commented = await (
      await post(path + '/comments', { viewer, author: 'Commenter', content: 'First' })
    ).json();
    const commentId = commented.ownedCommentId;
    const commentPath = path + `/comments/${commentId}`;
    assert.equal(commented.comments[0].ownerHash, undefined);
    assert.equal(
      (
        await post(commentPath + '/edit', {
          viewer,
          ownerToken: created.ownerToken,
          content: 'Forged',
        })
      ).status,
      403,
    );
    const editComment = await post(commentPath + '/edit', {
      viewer,
      ownerToken: commented.ownerToken,
      content: 'Changed',
    });
    assert.equal((await editComment.json()).comments[0].content, 'Changed');
    assert.equal(
      (await post(commentPath + '/reports', { viewer, reason: 'Spam', detail: 'Check comment' }))
        .status,
      200,
    );
    assert.equal((await reports('wrong')).status, 403);
    let queue = (await (await reports()).json()).reports;
    assert.equal(queue.length, 2);
    const legacyReport = queue.find((r) => r.kind === 'recipe');
    assert.equal(
      (await post(`/api/admin/reports/${legacyReport.id}/resolve`, { action: 'dismiss' }, key))
        .status,
      200,
    );
    const commentReport = queue.find((r) => r.kind === 'community');
    assert.equal(
      (await post(`/api/admin/reports/${commentReport.id}/resolve`, { action: 'remove' }, 'wrong'))
        .status,
      403,
    );
    assert.equal(
      (await post(`/api/admin/reports/${commentReport.id}/resolve`, { action: 'remove' }, key))
        .status,
      200,
    );
    assert.equal((await (await get(path)).json()).commentCount, 0);
    const secondComment = await (
      await post(path + '/comments', { viewer, author: 'Commenter', content: 'Delete me' })
    ).json();
    assert.equal(
      (
        await post(path + `/comments/${secondComment.ownedCommentId}/delete`, {
          viewer,
          ownerToken: secondComment.ownerToken,
        })
      ).status,
      200,
    );
    await server.stop();
    server = await startTestServer(storage, [`--ADMIN_KEY=${key}`]);
    const restored = await get(path);
    const restoredBody = await restored.json();
    assert.equal(restored.status, 200, JSON.stringify(restoredBody));
    assert.equal(restoredBody.title, 'Edited');
    queue = (await (await reports()).json()).reports;
    assert.deepEqual(queue, []);
    assert.equal(
      (
        await post(`/api/recipes/${recipeId}/reports`, {
          viewer,
          reason: '기타',
          detail: 'Hide recipe',
        })
      ).status,
      201,
    );
    const recipeReport = (await (await reports()).json()).reports[0];
    assert.equal(
      (await post(`/api/admin/reports/${recipeReport.id}/resolve`, { action: 'remove' }, key))
        .status,
      200,
    );
    assert.equal((await get(`/api/recipes/${recipeId}`)).status, 404);
    assert.equal((await (await get('/api/recipes')).json()).total, 0);
    assert.equal(await readFile(legacyFile, 'utf8'), raw);
    await access(join(storage, 'community', 'store.mv.db'));
    assert.equal(
      (await post(path + '/delete', { viewer, ownerToken: '0'.repeat(64) })).status,
      403,
    );
    assert.equal(
      (await post(path + '/delete', { viewer, ownerToken: created.ownerToken })).status,
      200,
    );
    // Delete migrated data, restart, and ensure its preserved JSON does not resurrect it.
    await post(`/api/community/posts/${legacyId}/reports`, {
      viewer,
      reason: 'Remove legacy',
      detail: '',
    });
    const legacyPostReport = (await (await reports()).json()).reports[0];
    await post(`/api/admin/reports/${legacyPostReport.id}/resolve`, { action: 'remove' }, key);
    await server.stop();
    server = await startTestServer(storage, [`--ADMIN_KEY=${key}`]);
    assert.equal((await get(path)).status, 404);
    assert.equal((await get(`/api/community/posts/${legacyId}`)).status, 404);
    assert.equal((await get(`/api/recipes/${recipeId}`)).status, 404);
    assert.equal((await (await reports()).json()).reports.length, 0);
  } finally {
    if (server) await server.stop();
    await rm(storage, { recursive: true, force: true });
  }
});

test('invalid legacy JSON rolls back migration and can be retried after repair', async () => {
  const storage = await mkdtemp(join(tmpdir(), 'hankki-migration-'));
  const first = '1000000000000-00000000-0000-4000-8000-000000000001';
  const second = '1000000000000-00000000-0000-4000-8000-000000000002';
  let server;
  try {
    const directory = join(storage, 'community');
    await mkdir(directory);
    const document = (id) =>
      JSON.stringify({
        id,
        title: 'Imported',
        content: 'Text',
        author: 'Old',
        revision: 0,
        createdAt: new Date().toISOString(),
        likes: [],
        comments: [],
      });
    await writeFile(join(directory, first + '.json'), document(first));
    await writeFile(join(directory, second + '.json'), '{');
    server = await startTestServer(storage);
    assert.equal((await fetch(server.base + '/api/community/posts')).status, 500);
    // If a failed import had committed the first row, the changed JSON would not be used on retry.
    await writeFile(
      join(directory, first + '.json'),
      document(first).replace('Imported', 'Repaired'),
    );
    await writeFile(join(directory, second + '.json'), document(second));
    const response = await fetch(server.base + '/api/community/posts');
    assert.equal(response.status, 200);
    const { posts } = await response.json();
    assert.equal(posts.length, 2);
    assert.equal(posts.find((p) => p.id === first).title, 'Repaired');
  } finally {
    if (server) await server.stop();
    await rm(storage, { recursive: true, force: true });
  }
});
