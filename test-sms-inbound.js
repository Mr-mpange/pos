const axios = require('axios');

const testSMSInbound = async () => {
  try {
    console.log('📱 Testing SMS Inbound (2-way SMS) functionality...\n');
    
    // Test 1: Simple greeting message
    console.log('1️⃣ Testing simple greeting message:');
    const response1 = await axios.post('https://12003a17fcd8.ngrok-free.app/sms/inbound', {
      text: 'Hello',
      from: '+255683859574',
      to: '34059', // Your shortcode
      date: new Date().toISOString(),
      id: 'test_msg_1',
      linkId: 'test_link_1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Response:', response1.data);
    console.log('✅ Should send AI reply to +255683859574\n');
    
    // Test 2: Shopping inquiry
    console.log('2️⃣ Testing shopping inquiry:');
    const response2 = await axios.post('https://12003a17fcd8.ngrok-free.app/sms/inbound', {
      text: 'I want to buy bread',
      from: '+255683859574',
      to: '34059',
      date: new Date().toISOString(),
      id: 'test_msg_2',
      linkId: 'test_link_2'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Response:', response2.data);
    console.log('✅ Should send AI shopping reply to +255683859574\n');
    
    console.log('🎯 Check server logs for SMS sending attempts...');
    
  } catch (error) {
    console.error('❌ SMS inbound test error:', error.response ? error.response.data : error.message);
  }
};

testSMSInbound();