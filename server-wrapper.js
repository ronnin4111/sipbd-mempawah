const { spawn } = require('child_process');
const fs = require('fs');

function startServer() {
  console.log('[Wrapper] Starting server...');
  const env = { 
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=1536'
  };
  const child = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
    env
  });

  const logStream = fs.createWriteStream('/home/z/my-project/dev.log', { flags: 'a' });

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
    logStream.write(data);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
    logStream.write(data);
  });

  child.on('exit', (code, signal) => {
    const msg = `[Wrapper] Server exited: code=${code} signal=${signal} at ${new Date().toISOString()}\n`;
    console.log(msg);
    logStream.write(msg);
    logStream.end();
    
    // Restart after 3 seconds
    setTimeout(startServer, 3000);
  });

  fs.writeFileSync('/home/z/my-project/.next-dev.pid', child.pid.toString());
}

startServer();
