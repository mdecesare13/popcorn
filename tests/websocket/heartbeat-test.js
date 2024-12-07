const { io } = require('socket.io-client');

console.log('Starting heartbeat test...');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected to server');
});

// Handle heartbeat pings
socket.on('heartbeat:ping', (data) => {
    console.log('Received heartbeat ping:', data);
    // Respond with pong
    socket.emit('heartbeat:pong', data);
});

socket.on('heartbeat:timeout', () => {
    console.log('Received heartbeat timeout!');
});

// Simulate missing heartbeats after 45 seconds
setTimeout(() => {
    console.log('Simulating dead connection (stopping pong responses)...');
    socket.removeAllListeners('heartbeat:ping');
}, 45000);

// Keep the script running
process.stdin.resume();