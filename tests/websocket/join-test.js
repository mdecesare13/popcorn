const { io } = require('socket.io-client');
const socket = io('http://localhost:3000');

// Test join data
const joinData = {
    partyId: '123',  // Same party ID as our create test
    userId: 'user456',
    userName: 'TestUser'
};

// Connection event
socket.on('connect', () => {
    console.log('Connected to server');

    // Join party
    console.log('Joining party...');
    socket.emit('party:join', joinData);
});

// Listen for state updates
socket.on('state:update', (data) => {
    console.log('State updated:', data);
});

// Listen for party errors
socket.on('party:error', (data) => {
    console.error('Party error:', data);
});

// Keep the script running
process.stdin.resume();