const { PARTY_EVENTS, STATE_EVENTS, USER_EVENTS } = require('../events');
const { redisClient } = require('../../app');

class PartyHandler {
    constructor(io) {
        this.io = io;
        // Track party members with Map: partyId -> Set of user objects
        this.partyMembers = new Map();
    }

    async trackUserInParty(partyId, socket, userData) {
        if (!this.partyMembers.has(partyId)) {
            this.partyMembers.set(partyId, new Set());
        }
        
        const partyUsers = this.partyMembers.get(partyId);
        const userInfo = {
            socketId: socket.id,
            userId: userData.userId,
            userName: userData.userName,
            status: 'active'
        };
        
        partyUsers.add(userInfo);
        
        if (redisClient) {
            // Update Redis with current party members
            await redisClient.hSet(`party:${partyId}:users`, socket.id, JSON.stringify(userInfo));
        }
        
        return userInfo;
    }

    async removeUserFromParty(socket) {
        // Find which party this socket was in
        for (const [partyId, users] of this.partyMembers.entries()) {
            const userArray = Array.from(users);
            const user = userArray.find(u => u.socketId === socket.id);
            
            if (user) {
                // Instead of deleting the user, mark them as inactive
                user.status = 'inactive';
                
                if (redisClient) {
                    // Update user status in Redis
                    await redisClient.hSet(`party:${partyId}:users`, socket.id, JSON.stringify(user));
                }
                
                // Notify remaining party members
                this.io.to(partyId).emit(USER_EVENTS.DISCONNECT, {
                    userId: user.userId,
                    userName: user.userName
                });
                
                // Only clean up party if all users are inactive
                const activeUsers = Array.from(users).filter(u => u.status === 'active');
                if (activeUsers.length === 0) {
                    // Keep the party data for potential reconnections
                    // but set a timeout to clean it up after 5 minutes
                    setTimeout(async () => {
                        const currentUsers = Array.from(users).filter(u => u.status === 'active');
                        if (currentUsers.length === 0) {
                            this.partyMembers.delete(partyId);
                            if (redisClient) {
                                await redisClient.del(`party:${partyId}`);
                                await redisClient.del(`party:${partyId}:users`);
                            }
                        }
                    }, 300000); // 5 minutes
                }
                
                return { partyId, user };
            }
        }
        return null;
    }

    async setUserReady(socket, partyId, isReady) {
        const partyUsers = this.partyMembers.get(partyId);
        if (!partyUsers) return false;
    
        const user = Array.from(partyUsers).find(u => u.socketId === socket.id);
        if (!user) return false;
    
        // Update user's ready status
        user.isReady = isReady;
        
        if (redisClient) {
            await redisClient.hSet(`party:${partyId}:users`, socket.id, JSON.stringify(user));
        }
    
        // Check if all users are ready
        const allUsers = Array.from(partyUsers);
        const allReady = allUsers.every(u => u.isReady);
    
        // Emit ready state update to all party members
        this.io.to(partyId).emit(USER_EVENTS.READY_STATE_CHANGE, {
            userId: user.userId,
            userName: user.userName,
            isReady,
            allReady
        });
    
        return allReady;
    }

    async handleReconnect(socket, data) {
        try {
            const { userId, partyId } = data;
            
            // Check if party exists
            const partyUsers = this.partyMembers.get(partyId);
            if (!partyUsers) {
                socket.emit(PARTY_EVENTS.ERROR, {
                    message: 'Party not found'
                });
                return;
            }
    
            // Find user's previous session
            const existingUser = Array.from(partyUsers).find(u => u.userId === userId);
            if (!existingUser) {
                socket.emit(PARTY_EVENTS.ERROR, {
                    message: 'User not found in party'
                });
                return;
            }
    
            // Update socket ID and rejoin room
            existingUser.socketId = socket.id;
            existingUser.status = 'active';
            socket.join(partyId);
    
            if (redisClient) {
                // Update Redis with new socket ID
                await redisClient.hSet(`party:${partyId}:users`, socket.id, JSON.stringify(existingUser));
            }
    
            // Notify other users
            this.io.to(partyId).emit(USER_EVENTS.STATUS_CHANGE, {
                userId: existingUser.userId,
                userName: existingUser.userName,
                status: 'active',
                message: 'User reconnected'
            });
    
            // Send current party state to reconnected user
            const partyState = {
                users: Array.from(partyUsers),
                partyId
            };
            
            socket.emit(STATE_EVENTS.SYNC, partyState);
            
            return true;
        } catch (error) {
            console.error('Error handling reconnection:', error);
            socket.emit(PARTY_EVENTS.ERROR, {
                message: 'Failed to reconnect'
            });
            return false;
        }
    }

    handleConnection(socket) {
        // Update existing party:create handler
        socket.on(PARTY_EVENTS.CREATE, async (data) => {
            try {
                socket.join(data.partyId);
                
                // Track host in party
                await this.trackUserInParty(data.partyId, socket, {
                    userId: data.hostId,
                    userName: data.userName
                });
                
                if (redisClient) {
                    await redisClient.hSet(`party:${data.partyId}`, {
                        hostId: data.hostId,
                        status: 'lobby',
                        currentSuite: '1'
                    });
                    await redisClient.expire(`party:${data.partyId}`, 24 * 60 * 60);
                }

                socket.emit(PARTY_EVENTS.STATE_CHANGE, {
                    status: 'lobby',
                    message: 'Party created successfully'
                });
            } catch (error) {
                console.error('Error creating party:', error);
                socket.emit(PARTY_EVENTS.ERROR, {
                    message: 'Failed to create party'
                });
            }
        });

        // Update existing party:join handler
        socket.on(PARTY_EVENTS.JOIN, async (data) => {
            try {
                socket.join(data.partyId);
                
                // Track new user in party
                const userInfo = await this.trackUserInParty(data.partyId, socket, {
                    userId: data.userId,
                    userName: data.userName
                });
                
                this.io.to(data.partyId).emit(STATE_EVENTS.UPDATE, {
                    type: 'userJoined',
                    user: userInfo
                });
            } catch (error) {
                console.error('Error joining party:', error);
                socket.emit(PARTY_EVENTS.ERROR, {
                    message: 'Failed to join party'
                });
            }
        });

        socket.on(USER_EVENTS.READY, async (data) => {
            try {
                const allReady = await this.setUserReady(socket, data.partyId, data.isReady);
                
                if (allReady) {
                    // When all users are ready, emit a party state change
                    this.io.to(data.partyId).emit(PARTY_EVENTS.STATE_CHANGE, {
                        status: 'ready',
                        message: 'All users ready'
                    });
                }
            } catch (error) {
                console.error('Error setting ready status:', error);
                socket.emit(PARTY_EVENTS.ERROR, {
                    message: 'Failed to update ready status'
                });
            }
        });

        socket.on(USER_EVENTS.CONNECT, async (data) => {
            try {
                if (data.isReconnect) {
                    await this.handleReconnect(socket, data);
                }
            } catch (error) {
                console.error('Error handling reconnection:', error);
                socket.emit(PARTY_EVENTS.ERROR, {
                    message: 'Failed to reconnect'
                });
            }
        });

        // Update disconnect handler
        socket.on('disconnect', async () => {
            try {
                const result = await this.removeUserFromParty(socket);
                if (result) {
                    console.log(`User disconnected from party ${result.partyId}`);
                }
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });
    }
}

module.exports = PartyHandler;