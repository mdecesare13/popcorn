const { io } = require('socket.io-client');

const partyId = 'test-party-789';
let user = io('http://localhost:3000');
const userId = 'user-789';

console.log('Starting reconnection test...');

// Initial connection
user.on('connect', () => {
    console.log('User initially connected');
    
    // Join party
    user.emit('party:join', {
        partyId,
        userId,
        userName: 'Reconnecting User'
    });
});

user.on('state:update', (data) => {
    console.log('State updated:', data);
});

// After 2 seconds, simulate disconnect and reconnect
setTimeout(() => {
    console.log('Simulating disconnect...');
    user.disconnect();
    
    // Wait 1 second then reconnect
    setTimeout(() => {
        console.log('Attempting reconnection...');
        user = io('http://localhost:3000');
        
        user.on('connect', () => {
            console.log('Socket reconnected, attempting to rejoin party...');
            user.emit('user:connect', {
                isReconnect: true,
                userId,
                partyId
            });
        });

        user.on('state:sync', (data) => {
            console.log('Received party state sync:', data);
        });

        user.on('party:error', (data) => {
            console.error('Reconnection error:', data);
        });
        
    }, 1000);
}, 2000);

// Keep the script running
process.stdin.resume();