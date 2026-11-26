import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
const windows = process.platform === 'win32';
const task = process.argv[2] || 'bootRun';
if (!['bootRun', 'build', 'clean'].includes(task)) throw new Error('Unsupported Gradle task');
const args = [
  '--gradle-user-home',
  process.env.GRADLE_USER_HOME || join(process.env.USERPROFILE || homedir(), '.gradle'),
  task,
];
const child = spawn(
  windows ? 'cmd.exe' : 'sh',
  windows ? ['/d', '/c', 'gradlew.bat', ...args] : ['gradlew', ...args],
  { stdio: 'inherit', env: { ...process.env, HOST: process.env.HOST || '127.0.0.1' } },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
