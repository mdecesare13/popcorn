const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';
let testPartyId;
let testUserId;

async function testVotingRoutes() {
    try {
        console.log('Testing voting routes...\n');

        // First create a party and get IDs to use
        console.log('Setting up test party...');
        const createResponse = await axios.post(`${API_BASE_URL}/party/create`, {
            host_name: 'Test Host',
            streaming_services: ['Netflix', 'Hulu']
        });
        testPartyId = createResponse.data.party_id;
        testUserId = createResponse.data.host_id;
        console.log('Test party created:', createResponse.data);

        // Test Suite 2 rating submission
        console.log('\nTesting SUBMIT rating...');
        const submitRatingResponse = await axios.put(`${API_BASE_URL}/party/${testPartyId}/rate`, {
            user_id: testUserId,
            movie_id: 'test-movie-1',
            rating: 8
        });
        console.log('Submit rating response:', submitRatingResponse.data);

        // Test get ratings
        console.log('\nTesting GET ratings...');
        const getRatingsResponse = await axios.get(`${API_BASE_URL}/party/${testPartyId}/ratings`);
        console.log('Get ratings response:', getRatingsResponse.data);

        // Test Suite 3 vote submission
        console.log('\nTesting SUBMIT vote...');
        const submitVoteResponse = await axios.put(`${API_BASE_URL}/party/${testPartyId}/vote`, {
            user_id: testUserId,
            movie_id: 'test-movie-1',
            vote: 'yes'
        });
        console.log('Submit vote response:', submitVoteResponse.data);

        // Test get votes
        console.log('\nTesting GET votes...');
        const getVotesResponse = await axios.get(`${API_BASE_URL}/party/${testPartyId}/votes`);
        console.log('Get votes response:', getVotesResponse.data);

    } catch (error) {
        if (error.response) {
            console.error('Server Error:', error.response.data);
        } else {
            console.error('Test failed:', error.message);
        }
    }
}

// Run the tests
testVotingRoutes();