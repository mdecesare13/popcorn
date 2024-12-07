// Party lifecycle events
const PARTY_EVENTS = {
    CREATE: 'party:create',
    JOIN: 'party:join',
    START: 'party:start',
    STATE_CHANGE: 'party:stateChange',
    ERROR: 'party:error'
};

// User presence events
const USER_EVENTS = {
    CONNECT: 'user:connect',
    DISCONNECT: 'user:disconnect',
    READY: 'user:ready',
    STATUS_CHANGE: 'user:statusChange',
    READY_STATE_CHANGE: 'user:readyStateChange'
};

// Suite-specific events
const SUITE_EVENTS = {
    SUBMIT_PREFERENCES: 'suite:submitPreferences',
    SUBMIT_RATING: 'suite:submitRating',
    SUBMIT_VOTE: 'suite:submitVote',
    COMPLETION: 'suite:completion'
};

// Real-time state events
const STATE_EVENTS = {
    REQUEST: 'state:request',
    UPDATE: 'state:update',
    SYNC: 'state:sync'
};

const HEARTBEAT_EVENTS = {
    PING: 'heartbeat:ping',
    PONG: 'heartbeat:pong',
    TIMEOUT: 'heartbeat:timeout'
};

module.exports = {
    PARTY_EVENTS,
    USER_EVENTS,
    SUITE_EVENTS,
    STATE_EVENTS,
    HEARTBEAT_EVENTS
};