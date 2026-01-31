const axios = require('axios');

const testVoiceActionsDebug = async () => {
  try {
    console.log('Testing voice actions endpoint for Hangup issue...');
    
    // Test the main voice actions endpoint
    console.log('\n1. Testing /voice/actions (main entry point):');
    const response1 = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/actions', {
      callSessionState: 'Answered',
      direction: 'Inbound',
      callerCountryCode: '255',
      sessionId: 'ATVId_debug_test',
      callerNumber: '+255788331124',
      destinationNumber: '+255699997983',
      callerCarrierName: 'Airtel',
      callStartTime: '2026-01-31+17:27:00',
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Voice Actions Response:');
    console.log(response1.data);
    
    // Test the shop-lang endpoint
    console.log('\n2. Testing /voice/shop-lang:');
    const response2 = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/shop-lang', {
      callSessionState: 'Answered',
      sessionId: 'ATVId_debug_test',
      callerNumber: '+255788331124',
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Shop Lang Response:');
    console.log(response2.data);
    
    // Test the shop endpoint
    console.log('\n3. Testing /voice/shop?lang=en:');
    const response3 = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/shop?lang=en', {
      callSessionState: 'Answered',
      sessionId: 'ATVId_debug_test',
      callerNumber: '+255788331124',
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Shop Response:');
    console.log(response3.data);
    
    // Check for any Hangup elements in responses
    const responses = [response1.data, response2.data, response3.data];
    responses.forEach((resp, index) => {
      if (resp.includes('Hangup')) {
        console.log(`\n❌ FOUND HANGUP in response ${index + 1}!`);
      } else {
        console.log(`\n✅ No Hangup found in response ${index + 1}`);
      }
    });
    
  } catch (error) {
    console.error('Voice debug test error:', error.response ? error.response.data : error.message);
  }
};

testVoiceActionsDebug();