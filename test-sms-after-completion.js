const axios = require('axios');

const testSMSAfterCompletion = async () => {
  try {
    console.log('🧪 Testing SMS notifications after completing operations...\n');
    
    // Test 1: USSD Order History (should trigger SMS)
    console.log('1️⃣ Testing USSD Order History completion:');
    const ussdOrderHistory = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_sms_test_orders',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859574',
      text: '1*4' // English + Order History
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('USSD Response:', ussdOrderHistory.data);
    console.log('✅ Should send SMS with order history to +255683859574\n');
    
    // Test 2: USSD Voice Instructions (should trigger SMS)
    console.log('2️⃣ Testing USSD Voice Instructions completion:');
    const ussdVoiceInstructions = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_sms_test_voice',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859574',
      text: '2*5' // Swahili + Call to Shop
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('USSD Response:', ussdVoiceInstructions.data);
    console.log('✅ Should send SMS with voice instructions to +255683859574\n');
    
    // Test 3: USSD Balance Check (should trigger SMS)
    console.log('3️⃣ Testing USSD Balance Check completion:');
    const ussdBalance = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_sms_test_balance',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859574',
      text: '1*3*1' // English + Wallet + Check Balance
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('USSD Response:', ussdBalance.data);
    console.log('✅ Should send SMS with balance info to +255683859574\n');
    
    // Test 4: Voice Shopping Checkout (simulate checkout completion)
    console.log('4️⃣ Testing Voice Shopping Checkout completion:');
    const voiceCheckout = await axios.post('https://12003a17fcd8.ngrok-free.app/voice/shop?lang=en', {
      callSessionState: 'Answered',
      sessionId: 'ATVId_sms_test_checkout',
      callerNumber: '+255683859574',
      dtmfDigits: '5', // Checkout
      isActive: '1'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Voice Response:', voiceCheckout.data);
    console.log('✅ Should send SMS with order confirmation to +255683859574\n');
    
    // Test 5: Different phone number for variety
    console.log('5️⃣ Testing with different phone number (+255788331124):');
    const ussdDifferentNumber = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_sms_test_diff',
      serviceCode: '*384*123#',
      phoneNumber: '+255788331124',
      text: '1*4' // English + Order History
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('USSD Response:', ussdDifferentNumber.data);
    console.log('✅ Should send SMS with order history to +255788331124\n');
    
    console.log('🎯 TEST SUMMARY:');
    console.log('================');
    console.log('📱 Check these phone numbers for SMS notifications:');
    console.log('   • +255683859574 (should receive 4 SMS messages)');
    console.log('   • +255788331124 (should receive 1 SMS message)');
    console.log('');
    console.log('📨 Expected SMS types:');
    console.log('   • Order history notifications');
    console.log('   • Voice shopping instructions');
    console.log('   • Wallet balance information');
    console.log('   • Order confirmation (from voice checkout)');
    console.log('');
    console.log('🔍 Check server logs for SMS sending attempts...');
    
  } catch (error) {
    console.error('❌ Test error:', error.response ? error.response.data : error.message);
  }
};

testSMSAfterCompletion();