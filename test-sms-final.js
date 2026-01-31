const axios = require('axios');

const testSMSFinal = async () => {
  try {
    console.log('🎯 FINAL SMS TEST - Testing 2-way SMS with corrected AI model\n');
    
    // Test 1: Simple greeting
    console.log('1️⃣ Testing greeting message:');
    const response1 = await axios.post('https://12003a17fcd8.ngrok-free.app/sms/inbound', {
      text: 'Hello',
      from: '+255683859574',
      to: '34059',
      date: new Date().toISOString(),
      id: 'final_test_1'
    });
    console.log('Response:', response1.data);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Shopping request
    console.log('\n2️⃣ Testing shopping request:');
    const response2 = await axios.post('https://12003a17fcd8.ngrok-free.app/sms/inbound', {
      text: 'I want to buy bread and milk',
      from: '+255683859574',
      to: '34059',
      date: new Date().toISOString(),
      id: 'final_test_2'
    });
    console.log('Response:', response2.data);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Balance inquiry
    console.log('\n3️⃣ Testing balance inquiry:');
    const response3 = await axios.post('https://12003a17fcd8.ngrok-free.app/sms/inbound', {
      text: 'balance',
      from: '+255683859574',
      to: '34059',
      date: new Date().toISOString(),
      id: 'final_test_3'
    });
    console.log('Response:', response3.data);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 4: Swahili message
    console.log('\n4️⃣ Testing Swahili message:');
    const response4 = await axios.post('https://12003a17fcd8.ngrok-free.app/sms/inbound', {
      text: 'Habari, nataka kununua chakula',
      from: '+255788331124',
      to: '34059',
      date: new Date().toISOString(),
      id: 'final_test_4'
    });
    console.log('Response:', response4.data);
    
    console.log('\n✅ SMS SYSTEM STATUS:');
    console.log('====================');
    console.log('📱 Check phones +255683859574 and +255788331124 for AI replies');
    console.log('🤖 AI should respond in detected language (English/Swahili)');
    console.log('💬 Responses should be contextual and helpful');
    console.log('🔍 Check server logs for detailed SMS sending status');
    
  } catch (error) {
    console.error('❌ Final SMS test error:', error.message);
  }
};

testSMSFinal();