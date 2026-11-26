import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

test('engagement budgets allow ten requests, share targets, and keep likes and reviews separate', async () => {
  const jars = (await readdir('build/libs')).filter(
    (name) => name.endsWith('.jar') && !name.endsWith('-plain.jar'),
  );
  assert.equal(jars.length, 1);
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
  const storage = await mkdtemp(join(tmpdir(), 'hankki-limits-'));
  const server = spawn(
    java,
    [
      '-jar',
      join('build/libs', jars[0]),
      '--server.port=0',
      '--server.address=127.0.0.1',
      '--OPENAI_API_KEY=',
      `--COMMUNITY_STORAGE=${join(storage, 'community')}`,
      `--RECIPE_STATS_STORAGE=${join(storage, 'stats')}`,
      `--MODERATION_STORAGE=${join(storage, 'moderation')}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  try {
    const base = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 30000);
      const read = (chunk) => {
        output += chunk.toString();
        const match = output.match(/Tomcat started on port (\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(`http://127.0.0.1:${match[1]}`);
        }
      };
      server.stdout.on('data', read);
      server.stderr.on('data', read);
      server.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      server.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited ${code}`));
      });
    });
    for (const action of ['like', 'reviews']) {
      for (let i = 0; i <= 10; i++) {
        const viewer = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
        // Different missing targets return 404 until the shared IP budget is exhausted.
        const path =
          action === 'like'
            ? `/api/community/posts/0000000000000-${viewer}/like`
            : `/api/recipes/ai-${viewer}/reviews`;
        const response = await fetch(base + path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${i}` },
          body: JSON.stringify({ viewer, liked: true, author: 'Test', rating: 5, content: '' }),
        });
        assert.equal(response.status, i < 10 ? 404 : 429);
        if (i === 10) {
          const retry = Number(response.headers.get('retry-after'));
          assert.ok(retry > 0 && retry <= 60);
        }
      }
    }
  } finally {
    if (server.exitCode === null)
      await new Promise((resolve) => {
        server.once('exit', resolve);
        server.kill();
      });
    await rm(storage, { recursive: true, force: true });
  }
});
