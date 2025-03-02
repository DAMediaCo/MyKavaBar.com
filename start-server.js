// Simple server starter script
const childProcess = require('child_process');
const fs = require('fs');

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function startServer() {
  log('Starting server...');
  
  const serverProcess = childProcess.spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true
  });

  serverProcess.on('error', (error) => {
    log(`Failed to start server: ${error.message}`);
  });

  serverProcess.on('exit', (code, signal) => {
    log(`Server process exited with code ${code} and signal ${signal}`);
  });
}

startServer();
