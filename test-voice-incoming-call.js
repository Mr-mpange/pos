const axios = require('axios');

const testVoiceIncomingCall = async () => {
  try {
    console.log('Testing incoming voice call simulation...');
    
    // Simulate AfricaTalking calling our /voice/actions endpoint when someone calls +255699997983
    console.log('\n1. Simulating incoming call to /voice/actions:');
    const response1 = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/actions', {
      callSessionState: 'Answered',
      direction: 'Inbound',
      callerCountryCode: '255',
      sessionId: 'ATVId_incoming_test',
      callerNumber: '+255683859574',
      destinationNumber: '+255699997983',
      callerCarrierName: 'Airtel',
      callStartTime: '2026-01-31+17:00:00',
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Response:', response1.data);
    
    // Test language selection
    console.log('\n2. Testing language selection (English - digit 1):');
    const response2 = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/shop-lang', {
      callSessionState: 'Answered',
      sessionId: 'ATVId_incoming_test',
      callerNumber: '+255683859574',
      dtmfDigits: '1',
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Language selection response:', response2.data);
    
    // Test shopping menu
    console.log('\n3. Testing shopping menu (first time):');
    const response3 = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/shop?lang=en', {
      callSessionState: 'Answered',
      sessionId: 'ATVId_incoming_test',
      callerNumber: '+255683859574',
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Shopping menu response:', response3.data);
    
  } catch (error) {
    console.error('Voice incoming call test error:', error.response ? error.response.data : error.message);
  }
};

testVoiceIncomingCall();