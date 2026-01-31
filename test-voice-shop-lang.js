const axios = require('axios');

const testVoiceShopLang = async () => {
  try {
    console.log('Testing voice shopping language selection...');
    
    // Test initial language selection
    console.log('\n1. Testing initial language selection:');
    const response1 = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/shop-lang', {
      callSessionState: 'Answered',
      sessionId: 'ATVId_test_lang',
      callerNumber: '+255683859574',
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log(response1.data);
    
    // Test language selection (English)
    console.log('\n2. Testing English selection (digit 1):');
    const response2 = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/shop-lang', {
      callSessionState: 'Answered',
      sessionId: 'ATVId_test_lang',
      callerNumber: '+255683859574',
      dtmfDigits: '1',
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log(response2.data);
    
    // Test language selection (Swahili)
    console.log('\n3. Testing Swahili selection (digit 2):');
    const response3 = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/shop-lang', {
      callSessionState: 'Answered',
      sessionId: 'ATVId_test_lang2',
      callerNumber: '+255683859574',
      dtmfDigits: '2',
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log(response3.data);
    
  } catch (error) {
    console.error('Voice shop lang test error:', error.response ? error.response.data : error.message);
  }
};

testVoiceShopLang();