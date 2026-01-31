const axios = require('axios');

const testSMSComprehensive = async () => {
  try {
    console.log('📱 COMPREHENSIVE SMS TEST - All Operations\n');
    
    // Test different phone numbers to verify SMS delivery
    const testNumbers = ['+255683859574', '+255788331124'];
    
    for (let i = 0; i < testNumbers.length; i++) {
      const phoneNumber = testNumbers[i];
      console.log(`\n🔄 Testing with phone number: ${phoneNumber}`);
      console.log('=' .repeat(50));
      
      // Test 1: Order History (English)
      console.log('\n1. Order History (English):');
      await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
        sessionId: `ATUid_comprehensive_${i}_1`,
        serviceCode: '*384*123#',
        phoneNumber: phoneNumber,
        text: '1*4'
      });
      console.log('✅ Triggered order history SMS');
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 2: Voice Instructions (Swahili)
      console.log('\n2. Voice Instructions (Swahili):');
      await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
        sessionId: `ATUid_comprehensive_${i}_2`,
        serviceCode: '*384*123#',
        phoneNumber: phoneNumber,
        text: '2*5'
      });
      console.log('✅ Triggered voice instructions SMS');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 3: Transaction History
      console.log('\n3. Transaction History:');
      await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
        sessionId: `ATUid_comprehensive_${i}_3`,
        serviceCode: '*384*123#',
        phoneNumber: phoneNumber,
        text: '1*3*3'
      });
      console.log('✅ Triggered transaction history SMS');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎯 FINAL SUMMARY:');
    console.log('=================');
    console.log('📱 SMS should be sent to:');
    testNumbers.forEach((num, index) => {
      console.log(`   ${index + 1}. ${num} - 3 SMS messages`);
    });
    console.log(`\n📊 Total SMS expected: ${testNumbers.length * 3} messages`);
    console.log('\n💡 Check your phones and server logs for delivery confirmation!');
    
  } catch (error) {
    console.error('❌ Comprehensive test error:', error.message);
  }
};

testSMSComprehensive();