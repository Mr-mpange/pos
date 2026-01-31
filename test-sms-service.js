const SMSService = require('./src/services/sms');

const testSMSService = async () => {
  try {
    console.log('Testing SMS Service directly...');
    
    // Test 1: Send a simple SMS
    console.log('\n1. Testing basic SMS send:');
    const result1 = await SMSService.sendSMS('+255683859574', 'Test SMS from Soko Connect POS system. This is a test message.');
    console.log('SMS Result:', result1);
    
    // Test 2: Send order confirmation
    console.log('\n2. Testing order confirmation SMS:');
    const mockOrder = {
      id: 'ORD123',
      total: 15000,
      items: [
        { name: 'Bread', quantity: 2, price: 2000 },
        { name: 'Milk', quantity: 1, price: 3000 }
      ]
    };
    const result2 = await SMSService.sendOrderConfirmation('+255683859574', mockOrder, 'en');
    console.log('Order SMS Result:', result2);
    
    // Test 3: Send voice instructions
    console.log('\n3. Testing voice instructions SMS:');
    const result3 = await SMSService.sendVoiceInstructions('+255683859574', '+255699997983', 'sw');
    console.log('Voice SMS Result:', result3);
    
    console.log('\n✅ Check your phone (+255683859574) for SMS messages!');
    
  } catch (error) {
    console.error('SMS Service test error:', error);
  }
};

testSMSService();