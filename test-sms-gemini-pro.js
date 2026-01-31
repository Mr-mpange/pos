const axios = require('axios');

const testSMSGeminiPro = async () => {
  try {
    console.log('🤖 Testing SMS with Gemini Pro model\n');
    
    // Test with a simple message
    console.log('Testing with simple message:');
    const response = await axios.post('https://12003a17fcd8.ngrok-free.app/sms/inbound', {
      text: 'Hello, I need help',
      from: '+255683859574',
      to: '34059',
      date: new Date().toISOString(),
      id: 'gemini_pro_test'
    });
    
    console.log('Response:', response.data);
    console.log('\n✅ Check server logs for Gemini Pro initialization and SMS sending...');
    
  } catch (error) {
    console.error('❌ Gemini Pro test error:', error.message);
  }
};

testSMSGeminiPro();