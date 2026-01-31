const axios = require('axios');

const testVoiceCallback = async () => {
  try {
    console.log('Testing voice callback (simulating AfricaTalking callback)...');
    
    // Simulate AfricaTalking callback when call is answered
    const response = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/call', {
      callSessionState: 'Answered',
      direction: 'Outbound',
      callerCountryCode: '255',
      sessionId: 'ATVId_test_callback',
      callerNumber: '+255683859574',
      destinationNumber: '+255699997983',
      callerCarrierName: 'Airtel',
      callStartTime: '2026-01-31+15:00:00',
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Voice callback test result:');
    console.log(response.data);
  } catch (error) {
    console.error('Voice callback test error:', error.response ? error.response.data : error.message);
  }
};

testVoiceCallback();