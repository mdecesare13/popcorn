require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('redis');
const partyRoutes = require('./routes/party');
const voteRoutes = require('./routes/vote');
const movieRoutes = require('./routes/movie');

// Initialize express app
const app = express();

// Redis client initialization
let redisClient = null;
if (process.env.NODE_ENV !== 'development') {
    redisClient = Redis.createClient({
        url: `redis://${process.env.REDIS_HOST || 'pop1kit3akpzug55.bfrx5n.ng.0001.use1.cache.amazonaws.com'}:6379`
    });

    // Connect to Redis
    (async () => {
        try {
            await redisClient.connect();
            console.log('Connected to Redis');
        } catch (err) {
            console.log('Redis connection failed:', err);
            // Don't fail the app if Redis isn't available
        }
    })();
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/party', partyRoutes);
app.use('/api/party', voteRoutes);
app.use('/api/party', movieRoutes);

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        redis: redisClient ? 'connected' : 'disabled'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = { app, redisClient };