const express = require('express');
const router = express.Router();
const axios = require('axios');
const { redisClient } = require('../app');
const { validatePartyId } = require('../middleware/validation');

// Cache duration in seconds
const CACHE_DURATION = 60;

// Lambda function URLs from env
const GET_MOVIES_URL = process.env.GET_MOVIES_URL;

router.get('/:partyId/movies', validatePartyId, async (req, res) => {
    try {
        const { partyId } = req.params;
        
        // Check cache first
        if (redisClient) {
            const cachedData = await redisClient.get(`party:${partyId}:movies`);
            if (cachedData) {
                return res.json(JSON.parse(cachedData));
            }
        }
        
        // Debug logging
        console.log('GET_MOVIES_URL:', GET_MOVIES_URL);
        console.log('Party ID:', partyId);
        
        // Replace {party_id} in the URL with actual ID
        const url = GET_MOVIES_URL.replace('{party_id}', partyId);
        console.log('Making request to:', url);
        
        const response = await axios.get(url);
        
        // Cache successful response
        if (redisClient && response.data) {
            await redisClient.setEx(
                `party:${partyId}:movies`,
                CACHE_DURATION,
                JSON.stringify(response.data)
            );
        }
        
        res.json(response.data);
    } catch (error) {
        console.error('Error getting movies:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to get movie selections' });
    }
});

module.exports = router;