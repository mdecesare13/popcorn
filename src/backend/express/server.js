const { app } = require('./app');
const { Server } = require('socket.io');
const http = require('http');
const PartyHandler = require('./socket/handlers/partyHandler');
const HeartbeatHandler = require('./socket/handlers/heartbeatHandler');
const { HEARTBEAT_EVENTS } = require('./socket/events');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"]
    }
});

// Initialize handlers
const partyHandler = new PartyHandler(io);
const heartbeatHandler = new HeartbeatHandler(io);  // Add this

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log('A user connected');
    
    // Start heartbeat monitoring
    heartbeatHandler.startHeartbeat(socket);
    
    // Handle heartbeat responses
    socket.on(HEARTBEAT_EVENTS.PONG, (data) => {
        heartbeatHandler.handlePong(socket, data);
    });
    
    // Existing party handler
    partyHandler.handleConnection(socket);
    
    socket.on('disconnect', () => {
        heartbeatHandler.stopHeartbeat(socket);
        console.log('User disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});