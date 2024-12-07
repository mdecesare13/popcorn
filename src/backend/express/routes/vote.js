const express = require('express');
const router = express.Router();
const axios = require('axios');
const { redisClient } = require('../app');
const { validatePartyId, validateRating, validateVote } = require('../middleware/validation');

// Lambda function URLs from environment
const LAMBDA_URLS = {
    SUBMIT_RATING: process.env.SUBMIT_RATING_URL,
    GET_RATINGS: process.env.GET_RATINGS_URL,
    SUBMIT_VOTE: process.env.SUBMIT_VOTE_URL,
    GET_VOTES: process.env.GET_VOTES_URL
};

// Suite 2 - Submit Rating
router.put('/:partyId/rate', [validatePartyId, validateRating], async (req, res) => {
    try {
        const { partyId } = req.params;
        console.log('SUBMIT_RATING_URL:', LAMBDA_URLS.SUBMIT_RATING);
        console.log('Rating request data:', {
            user_id: req.body.user_id,
            movie_id: req.body.movie_id,
            rating: req.body.rating
        });
        
        const url = LAMBDA_URLS.SUBMIT_RATING.replace('{party_id}', partyId);
        console.log('Making request to:', url);
        
        const response = await axios.put(url, {
            user_id: req.body.user_id,
            movie_id: req.body.movie_id,
            rating: req.body.rating
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error submitting rating:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to submit rating' });
    }
});

// Suite 2 - Get Ratings
router.get('/:partyId/ratings', validatePartyId, async (req, res) => {
    try {
        const { partyId } = req.params;
        const url = LAMBDA_URLS.GET_RATINGS.replace('{party_id}', partyId);
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error('Error getting ratings:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to get ratings' });
    }
});

// Suite 3 - Submit Vote
router.put('/:partyId/vote', [validatePartyId, validateVote], async (req, res) => {
    try {
        const { partyId } = req.params;
        const url = LAMBDA_URLS.SUBMIT_VOTE.replace('{party_id}', partyId);
        const response = await axios.put(url, {
            user_id: req.body.user_id,
            movie_id: req.body.movie_id,
            vote: req.body.vote  // "yes", "no", or "seen"
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error submitting vote:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to submit vote' });
    }
});

// Suite 3 - Get Votes
router.get('/:partyId/votes', validatePartyId, async (req, res) => {
    try {
        const { partyId } = req.params;
        const url = LAMBDA_URLS.GET_VOTES.replace('{party_id}', partyId);
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error('Error getting votes:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to get votes' });
    }
});

module.exports = router;