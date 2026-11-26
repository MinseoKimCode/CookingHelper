import {spawn} from 'node:child_process';
const windows = process.platform === 'win32';
const child = spawn(windows ? 'cmd.exe' : 'sh',
  windows ? ['/d','/c','gradlew.bat','bootRun'] : ['gradlew','bootRun'],
  {stdio:'inherit'});
child.on('error', error => { console.error(error.message); process.exitCode=1; });
child.on('exit', code => { process.exitCode=code ?? 1; });
