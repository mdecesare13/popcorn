const { io } = require('socket.io-client');

// Create two socket connections
const host = io('http://localhost:3000');
const user = io('http://localhost:3000');

const partyId = 'test-party-123';

// Host connection
host.on('connect', () => {
    console.log('Host connected');
    // Create party
    host.emit('party:create', {
        partyId: partyId,
        hostId: 'host-123',
        userName: 'Host User'
    });
});

// User connection
user.on('connect', () => {
    console.log('User connected');
    // Join party
    user.emit('party:join', {
        partyId: partyId,
        userId: 'user-123',
        userName: 'Test User'
    });
});

// Listen for state updates on both connections
[host, user].forEach(socket => {
    socket.on('state:update', (data) => {
        console.log('State updated:', data);
    });

    socket.on('user:disconnect', (data) => {
        console.log('User disconnected:', data);
    });
});

// After 5 seconds, disconnect the user
setTimeout(() => {
    console.log('Disconnecting user...');
    user.disconnect();
}, 5000);

// Keep the script running
process.stdin.resume();