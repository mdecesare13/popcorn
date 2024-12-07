const express = require('express');
const router = express.Router();
const axios = require('axios');
const { redisClient } = require('../app');
const { validatePartyId, validatePartyCreation, validateJoinParty } = require('../middleware/validation');

// Cache duration in seconds
const CACHE_DURATION = 60;

// Lambda function URLs (we'll need to get these from API Gateway)
const LAMBDA_URLS = {
    CREATE_PARTY: process.env.CREATE_PARTY_URL,
    JOIN_PARTY: process.env.JOIN_PARTY_URL,
    GET_PARTY: process.env.GET_PARTY_URL
};

// Create party
router.post('/create', validatePartyCreation, async (req, res) => {
    try {
        console.log('Creating party with data:', req.body);  // Add this log
        const response = await axios.post(LAMBDA_URLS.CREATE_PARTY, req.body);
        
        // Cache party data
        if (redisClient && response.data.party_id) {
            const partyData = response.data;
            await redisClient.setEx(
                `party:${partyData.party_id}:details`, 
                CACHE_DURATION,
                JSON.stringify(partyData)
            );
        }
        
        res.json(response.data);
    } catch (error) {
        console.error('Error creating party:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to create party' });
    }
});

// Get party details
router.get('/:partyId', validatePartyId, async (req, res) => {
    try {
        const { partyId } = req.params;
        
        // Check cache first
        if (redisClient) {
            const cachedData = await redisClient.get(`party:${partyId}:details`);
            if (cachedData) {
                return res.json(JSON.parse(cachedData));
            }
        }
        
        // Debug logging
        console.log('GET_PARTY_URL:', LAMBDA_URLS.GET_PARTY);
        console.log('Party ID:', partyId);
        
        // Replace {party_id} in the URL with actual ID
        const url = LAMBDA_URLS.GET_PARTY.replace('{party_id}', partyId);
        console.log('Making request to:', url);
        
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error('Error getting party:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to get party details' });
    }
});

// Join party
router.post('/:partyId/join', [validatePartyId, validateJoinParty], async (req, res) => {
    try {
        const { partyId } = req.params;
        console.log('JOIN_PARTY_URL:', LAMBDA_URLS.JOIN_PARTY);
        console.log('Join party request data:', { user_name: req.body.user_name });
        
        // Replace party_id in URL
        const url = LAMBDA_URLS.JOIN_PARTY.replace('{party_id}', partyId);
        console.log('Making request to:', url);
        
        // Send only user_name in body and use PUT
        const response = await axios.put(url, {
            user_name: req.body.user_name
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error joining party:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to join party' });
    }
});

module.exports = router;