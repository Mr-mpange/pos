const axios = require('axios');

const testVoiceCall = async () => {
  try {
    console.log('Testing voice call with callback URL...');
    const response = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/call', {
      callTo: '+255683859574',
      callFrom: '+255699997983'
    });
    console.log('Voice call test result:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Voice call test error:', error.response ? error.response.data : error.message);
  }
};

testVoiceCall();