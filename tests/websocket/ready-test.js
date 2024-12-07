const { io } = require('socket.io-client');

const partyId = 'test-party-456';
const host = io('http://localhost:3000');
const user = io('http://localhost:3000');

// Track ready state changes
function logReadyStateChange(socket, name) {
    socket.on('user:readyStateChange', (data) => {
        console.log(`${name} received ready state change:`, data);
        if (data.allReady) {
            console.log('All users are ready!');
        }
    });

    socket.on('party:stateChange', (data) => {
        console.log(`${name} received party state change:`, data);
    });
}

// Host connection
host.on('connect', () => {
    console.log('Host connected');
    host.emit('party:create', {
        partyId,
        hostId: 'host-456',
        userName: 'Host User'
    });
    logReadyStateChange(host, 'Host');
});

// User connection
user.on('connect', () => {
    console.log('User connected');
    user.emit('party:join', {
        partyId,
        userId: 'user-456',
        userName: 'Test User'
    });
    logReadyStateChange(user, 'User');
});

// After 2 seconds, set host ready
setTimeout(() => {
    console.log('Setting host ready...');
    host.emit('user:ready', { partyId, isReady: true });
}, 2000);

// After 4 seconds, set user ready
setTimeout(() => {
    console.log('Setting user ready...');
    user.emit('user:ready', { partyId, isReady: true });
}, 4000);

// Keep the script running
process.stdin.resume();