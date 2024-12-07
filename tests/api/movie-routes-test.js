// tests/api/movie-routes-test.js
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

async function testMovieRoutes() {
    try {
        console.log('Testing movie routes...');

        // First create a party to test with
        console.log('Testing create party route...');
        const createResponse = await axios.post(`${API_BASE_URL}/party/create`, {
            host_name: 'Test Host',
            streaming_services: ['Netflix', 'Hulu']
        });
        console.log(createResponse.data.party_id);
        const partyId = createResponse.data.party_id;

        // Test get movies - valid request
        console.log('\nTesting GET movies...');
        const getMoviesResponse = await axios.get(`${API_BASE_URL}/party/${partyId}/movies`);
        console.log('Get movies response:', getMoviesResponse.data);

        // Test validation - invalid party ID
        console.log('\nTesting GET movies with invalid party ID...');
        try {
            await axios.get(`${API_BASE_URL}/party/invalid-uuid/movies`);
        } catch (error) {
            console.log('Expected validation error:', error.response.data);
        }

    } catch (error) {
        if (error.response) {
            console.error('Server Error:', error.response.data);
        } else {
            console.error('Test failed:', error.message);
        }
    }
}

async function testValidationRoutes() {
    try {
        console.log('\nTesting validation middleware...');
        
        // Test party creation validation
        console.log('\nTesting CREATE party validation...');
        try {
            await axios.post(`${API_BASE_URL}/party/create`, {
                streaming_services: ['Netflix'] // Missing host_name
            });
        } catch (error) {
            console.log('Expected validation error:', error.response.data);
        }

        try {
            await axios.post(`${API_BASE_URL}/party/create`, {
                host_name: 'Test Host',
                streaming_services: [] // Empty services
            });
        } catch (error) {
            console.log('Expected validation error:', error.response.data);
        }

        // Test rating validation
        console.log('\nTesting RATING validation...');
        try {
            await axios.put(`${API_BASE_URL}/party/71eacbe7-f07c-471c-94a4-550c08b3d744/rate`, {
                user_id: 'test-user',
                movie_id: 'test-movie',
                rating: 11 // Invalid rating
            });
        } catch (error) {
            console.log('Expected validation error:', error.response.data);
        }

        // Test vote validation
        console.log('\nTesting VOTE validation...');
        try {
            await axios.put(`${API_BASE_URL}/party/71eacbe7-f07c-471c-94a4-550c08b3d744/vote`, {
                user_id: 'test-user',
                movie_id: 'test-movie',
                vote: 'maybe' // Invalid vote
            });
        } catch (error) {
            console.log('Expected validation error:', error.response.data);
        }

    } catch (error) {
        if (error.response) {
            console.error('Server Error:', error.response.data);
        } else {
            console.error('Test failed:', error.message);
        }
    }
}

// Run all tests
async function runAllTests() {
    console.log('Starting API route tests...\n');
    await testMovieRoutes();
    await testValidationRoutes();
    console.log('\nAll tests completed!');
}

runAllTests();