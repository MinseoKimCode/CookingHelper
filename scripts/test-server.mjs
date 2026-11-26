import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function startTestServer(storage, extra = []) {
  const jars = (await readdir('build/libs')).filter(
    (name) => name.endsWith('.jar') && !name.endsWith('-plain.jar'),
  );
  if (jars.length !== 1) throw new Error('Run npm test to build the server first');
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
  const processHandle = spawn(
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
      ...extra,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const stop = async () => {
    if (processHandle.exitCode === null)
      await new Promise((resolve) => {
        processHandle.once('exit', resolve);
        processHandle.kill();
      });
  };
  try {
    const base = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(
        () => reject(new Error('Server startup timed out: ' + output)),
        30000,
      );
      const read = (chunk) => {
        output += chunk.toString();
        const match = output.match(/Tomcat started on port (\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(`http://127.0.0.1:${match[1]}`);
        }
      };
      processHandle.stdout.on('data', read);
      processHandle.stderr.on('data', read);
      processHandle.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      processHandle.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited ${code}: ${output}`));
      });
    });
    return { base, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
