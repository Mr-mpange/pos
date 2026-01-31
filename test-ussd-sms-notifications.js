const axios = require('axios');

const testUSSDSMSNotifications = async () => {
  try {
    console.log('Testing USSD SMS Notifications...');
    
    // Test 1: Order History (should send SMS)
    console.log('\n1. Testing Order History with SMS:');
    const response1 = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_sms_test1',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859574',
      text: '1*4' // English + Order History
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Order History Response:', response1.data);
    
    // Test 2: Voice Instructions (should send SMS)
    console.log('\n2. Testing Voice Instructions with SMS:');
    const response2 = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_sms_test2',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859574',
      text: '2*5' // Swahili + Call to Shop
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Voice Instructions Response:', response2.data);
    
    // Test 3: Balance Inquiry (should send SMS)
    console.log('\n3. Testing Balance Inquiry with SMS:');
    const response3 = await axios.post('https://12003a17fcd8.ngrok-free.app/ussd', {
      sessionId: 'ATUid_sms_test3',
      serviceCode: '*384*123#',
      phoneNumber: '+255683859574',
      text: '1*3*1' // English + Wallet + Check Balance
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Balance Inquiry Response:', response3.data);
    
    console.log('\n✅ SMS notifications should be sent to +255683859574 for all completed operations');
    console.log('Check your phone for SMS confirmations!');
    
  } catch (error) {
    console.error('USSD SMS test error:', error.response ? error.response.data : error.message);
  }
};

testUSSDSMSNotifications();