const { spawn } = require('child_process');
const fs = require('fs');

console.log('Starting Next.js dev server...');

const child = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
  cwd: '/home/z/my-project',
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_OPTIONS: '' },
});

const logStream = fs.createWriteStream('/home/z/my-project/dev.log', { flags: 'w' });

child.stdout.pipe(logStream);
child.stderr.pipe(logStream);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on('exit', (code, signal) => {
  const msg = `Server exited: code=${code} signal=${signal}\n`;
  logStream.write(msg);
  console.log(msg);
});

fs.writeFileSync('/home/z/my-project/.next-dev.pid', child.pid.toString());
console.log('Server PID:', child.pid);

// Keep the process alive
setInterval(() => {
  try {
    const isAlive = child.pid && !child.killed;
    if (!isAlive) {
      console.log('Server process died, exiting launcher');
      process.exit(1);
    }
  } catch (e) {
    process.exit(1);
  }
}, 5000);
