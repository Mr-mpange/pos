const axios = require('axios');

const testVoiceCallCorrectDirection = async () => {
  try {
    console.log('Testing voice call with correct direction...');
    const response = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/call', {
      callFrom: '+255683859574',  // User's number
      callTo: '+255699997983'     // AfricaTalking voice number
    });
    console.log('Voice call test result:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Voice call test error:', error.response ? error.response.data : error.message);
  }
};

testVoiceCallCorrectDirection();