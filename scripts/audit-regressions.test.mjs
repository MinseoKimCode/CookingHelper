import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startTestServer } from './test-server.mjs';

test('encoded and matrix paths cannot bypass AI quotas; YouTube GET has a shared budget', async () => {
  let calls = 0;
  const provider = http.createServer(async (request, response) => {
    for await (const _chunk of request) {
      /* drain fixture request */
    }
    calls++;
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        output: [{ content: [{ type: 'output_text', text: '{"ingredients":[]}' }] }],
      }),
    );
  });
  await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const storage = await mkdtemp(join(tmpdir(), 'hankki-audit-regression-'));
  let server;
  try {
    server = await startTestServer(storage, [
      '--AI_REQUESTS_PER_HOUR=1',
      '--AI_TOTAL_REQUESTS_PER_DAY=1',
      '--YOUTUBE_REQUESTS_PER_HOUR=2',
      '--YOUTUBE_TOTAL_REQUESTS_PER_DAY=2',
      '--YOUTUBE_API_KEY=',
      '--OPENAI_API_KEY=fixture',
      `--OPENAI_BASE_URL=http://127.0.0.1:${provider.address().port}/v1`,
    ]);
    const image =
      'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a00000000', 'hex').toString('base64');
    const post = (path) =>
      fetch(server.base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
    assert.equal((await post('/api/recognize')).status, 200);
    assert.equal((await post('/api/recognize')).status, 429);
    for (const path of [
      '/api/%72ecognize',
      '/%61pi/recognize',
      '/api/recognize;x=1',
      '/api//recognize',
      '/api/%2572ecognize',
    ])
      assert.equal((await post(path)).status, 400);
    assert.equal(calls, 1);
    assert.equal((await fetch(server.base + '/api/youtube/videos?q=first')).status, 503);
    assert.equal((await fetch(server.base + '/api/youtube/videos?q=second')).status, 503);
    const blocked = await fetch(server.base + '/api/youtube/channels');
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('retry-after')) > 60);
  } finally {
    if (server) await server.stop();
    await new Promise((resolve) => provider.close(resolve));
    await rm(storage, { recursive: true, force: true });
  }
});
