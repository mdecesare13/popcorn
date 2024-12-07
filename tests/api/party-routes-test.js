const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

async function testPartyRoutes() {
    try {
        console.log('Testing party routes...');

        // Test create party
        console.log('\nTesting CREATE party...');
        const createResponse = await axios.post(`${API_BASE_URL}/party/create`, {
            host_name: 'Test Host',  // Changed from hostName to host_name
            streaming_services: ['Netflix', 'Hulu']
        });
        console.log('Create party response:', createResponse.data);

        const partyId = createResponse.data.party_id;

        // Test get party
        console.log('\nTesting GET party...');
        const getResponse = await axios.get(`${API_BASE_URL}/party/${partyId}`);
        console.log('Get party response:', getResponse.data);

        // Test join party
        console.log('\nTesting JOIN party...');
        const joinResponse = await axios.post(`${API_BASE_URL}/party/${partyId}/join`, {
            user_name: 'Test User'  // Note: using snake_case to match Lambda
        });
        console.log('Join party response:', joinResponse.data);

    } catch (error) {
        if (error.response) {
            // Log the detailed error from the server
            console.error('Server Error:', error.response.data);
        } else {
            console.error('Test failed:', error.message);
        }
    }
}

// Run the tests
testPartyRoutes();