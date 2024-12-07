const { HEARTBEAT_EVENTS, USER_EVENTS } = require('../events');

class HeartbeatHandler {
    constructor(io) {
        this.io = io;
        this.heartbeats = new Map();
        this.HEARTBEAT_INTERVAL = 30000; // 30 seconds
        this.HEARTBEAT_TIMEOUT = 5000;   // 5 seconds to respond
    }

    startHeartbeat(socket) {
        // Clear any existing interval
        if (this.heartbeats.has(socket.id)) {
            clearInterval(this.heartbeats.get(socket.id).interval);
        }

        const heartbeatInterval = setInterval(() => {
            const timestamp = Date.now();
            socket.emit(HEARTBEAT_EVENTS.PING, { timestamp });

            const timeoutId = setTimeout(() => {
                console.log(`Heartbeat timeout for socket ${socket.id}`);
                socket.emit(HEARTBEAT_EVENTS.TIMEOUT);
                socket.disconnect(true);
            }, this.HEARTBEAT_TIMEOUT);

            this.heartbeats.set(socket.id, {
                timestamp,
                timeoutId,
                interval: heartbeatInterval
            });
        }, this.HEARTBEAT_INTERVAL);

        this.heartbeats.set(socket.id, { interval: heartbeatInterval });
    }

    handlePong(socket, data) {
        const heartbeat = this.heartbeats.get(socket.id);
        if (heartbeat && heartbeat.timeoutId) {
            clearTimeout(heartbeat.timeoutId);
        }
    }

    stopHeartbeat(socket) {
        const heartbeat = this.heartbeats.get(socket.id);
        if (heartbeat) {
            if (heartbeat.interval) clearInterval(heartbeat.interval);
            if (heartbeat.timeoutId) clearTimeout(heartbeat.timeoutId);
            this.heartbeats.delete(socket.id);
        }
    }
}

module.exports = HeartbeatHandler;