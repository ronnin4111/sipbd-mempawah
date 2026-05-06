const { spawn } = require('child_process');
const fs = require('fs');

const LOG_FILE = '/home/z/my-project/dev.log';
const PID_FILE = '/home/z/my-project/.next-dev.pid';

function startServer() {
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  logStream.write(`\n[Daemon] Starting server at ${new Date().toISOString()}\n`);
  
  const child = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: { ...process.env },
  });
  
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  
  fs.writeFileSync(PID_FILE, child.pid.toString());
  logStream.write(`[Daemon] Server PID: ${child.pid}\n`);
  
  child.on('exit', (code, signal) => {
    logStream.write(`[Daemon] Server exited: code=${code} signal=${signal}\n`);
    // Restart after 3 seconds
    setTimeout(startServer, 3000);
  });
  
  child.unref();
  return child;
}

startServer();

// Keep this process alive with a heartbeat
setInterval(() => {
  fs.appendFileSync(LOG_FILE, `[Daemon] Heartbeat at ${new Date().toISOString()}\n`);
}, 60000);
