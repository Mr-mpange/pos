const axios = require('axios');

const testUSSDCallInstructions = async () => {
  try {
    console.log('Testing USSD Call to Shop instructions...');
    
    // Test English (1*5)
    console.log('\n1. Testing English Call to Shop:');
    const response1 = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_test_en',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859574',
      text: '1*5'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log(response1.data);
    
    // Test Swahili (2*5)
    console.log('\n2. Testing Swahili Call to Shop:');
    const response2 = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_test_sw',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859575',
      text: '2*5'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log(response2.data);
    
  } catch (error) {
    console.error('USSD Call instructions test error:', error.response ? error.response.data : error.message);
  }
};

testUSSDCallInstructions();