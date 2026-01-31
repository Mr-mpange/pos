const axios = require('axios');

const testUSSDCallToShop = async () => {
  try {
    console.log('Testing USSD Call to Shop option...');
    
    // Test language selection + Call to Shop (1*5)
    const response = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_test_12345',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859574',
      text: '1*5'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('USSD Call to Shop test result:', response.data);
  } catch (error) {
    console.error('USSD Call to Shop test error:', error.response ? error.response.data : error.message);
  }
};

testUSSDCallToShop();