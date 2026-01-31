const axios = require('axios');

const testUSSDVoiceInstructions = async () => {
  try {
    console.log('Testing USSD Voice Call Instructions...');
    
    // Clear any existing sessions first
    console.log('\n1. Testing English Voice Instructions (1*5):');
    const response1 = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_fresh_en',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859999',
      text: '1*5'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log(response1.data);
    
    console.log('\n2. Testing Swahili Voice Instructions (2*5):');
    const response2 = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_fresh_sw',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859998',
      text: '2*5'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log(response2.data);
    
  } catch (error) {
    console.error('USSD Voice instructions test error:', error.response ? error.response.data : error.message);
  }
};

testUSSDVoiceInstructions();