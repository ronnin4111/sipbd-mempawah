const { spawn } = require('child_process');
const fs = require('fs');

const child = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
  env: { ...process.env }
});

const logFile = fs.openSync('/home/z/my-project/dev.log', 'a');
child.stdout.on('data', (data) => fs.writeSync(logFile, data));
child.stderr.on('data', (data) => fs.writeSync(logFile, data));

child.on('exit', (code, signal) => {
  fs.writeSync(logFile, `\nServer exited: code=${code} signal=${signal}\n`);
  fs.closeSync(logFile);
});

// Write PID file
fs.writeFileSync('/home/z/my-project/.next-dev.pid', child.pid.toString());

// Unref so the launcher can exit while the server keeps running
child.unref();

console.log('Server PID:', child.pid);
console.log('Launcher exiting, server running in background');
