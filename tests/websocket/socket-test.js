const { io } = require('socket.io-client');
const socket = io('http://localhost:3000');

// Test party creation
const testParty = {
    partyId: '123',
    hostId: 'host123',
    userName: 'TestHost'
};

// Connection event
socket.on('connect', () => {
    console.log('Connected to server');

    // Create party
    console.log('Creating party...');
    socket.emit('party:create', testParty);
});

// Listen for party state changes
socket.on('party:stateChange', (data) => {
    console.log('Party state changed:', data);
});

// Listen for party errors
socket.on('party:error', (data) => {
    console.error('Party error:', data);
});

// Keep the script running
process.stdin.resume();