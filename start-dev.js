const { spawn } = require('child_process');

console.log('\x1b[36m🚀 Starting POS Application (Server + Client)...\x1b[0m');
console.log('\x1b[33mPress Ctrl+C to stop all services\x1b[0m\n');

let isShuttingDown = false;

// Start Backend Server
const server = spawn('npm', ['run', 'dev:server'], { 
    stdio: 'inherit', 
    shell: true 
});

// Start Frontend Client
const client = spawn('npm', ['run', 'dev:client'], { 
    stdio: 'inherit', 
    shell: true 
});

// Handle unexpected exits
server.on('close', (code) => {
    if (!isShuttingDown && code !== 0) {
        console.log(`\n\x1b[31mBackend server stopped unexpectedly with code ${code}\x1b[0m`);
        isShuttingDown = true;
        client.kill();
        process.exit(1);
    }
});

client.on('close', (code) => {
    if (!isShuttingDown && code !== 0) {
        console.log(`\n\x1b[31mFrontend client stopped unexpectedly with code ${code}\x1b[0m`);
        isShuttingDown = true;
        server.kill();
        process.exit(1);
    }
});

// Handle shutdown
process.on('SIGINT', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n\x1b[31m🛑 Shutting down services...\x1b[0m');
    server.kill();
    client.kill();
    process.exit();
});