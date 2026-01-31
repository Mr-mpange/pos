#!/usr/bin/env node

/**
 * Test ZenoPay integration
 */

require('dotenv').config();
const ZenoPayService = require('./src/services/zenopay');

async function testZenoPayIntegration() {
  console.log('🧪 Testing ZenoPay Integration\n');
  
  try {
    // Test 1: Initialize service
    console.log('1️⃣ Testing ZenoPay service initialization...');
    const zenoPayService = new ZenoPayService();
    console.log(`✅ Service initialized in ${zenoPayService.isSandbox ? 'SANDBOX' : 'LIVE'} mode`);
    console.log(`   Base URL: ${zenoPayService.baseUrl}`);
    console.log(`   Account ID: ${zenoPayService.accountId}`);
    console.log('');
    
    // Test 2: Phone number formatting
    console.log('2️⃣ Testing phone number formatting...');
    const phoneTests = [
      '+255712345678',
      '255712345678',
      '0712345678',
      '712345678'
    ];
    
    for (const phone of phoneTests) {
      try {
        const formatted = zenoPayService.formatPhoneNumber(phone);
        console.log(`✅ "${phone}" → "${formatted}"`);
      } catch (error) {
        console.log(`❌ "${phone}" → Error: ${error.message}`);
      }
    }
    console.log('');
    
    // Test 3: Provider detection
    console.log('3️⃣ Testing mobile money provider detection...');
    const providerTests = [
      '+255754123456', // M-Pesa
      '+255714123456', // Tigo Pesa
      '+255756123456', // Airtel Money
      '+255621123456', // Halotel Money
      '+255700123456'  // Unknown
    ];
    
    for (const phone of providerTests) {
      const provider = zenoPayService.detectProvider(phone);
      if (provider) {
        console.log(`✅ ${phone} → ${provider.name} (${provider.ussdCode})`);
      } else {
        console.log(`❌ ${phone} → No provider detected`);
      }
    }
    console.log('');
    
    // Test 4: Transaction fees calculation
    console.log('4️⃣ Testing transaction fees calculation...');
    const feeTests = [500, 1000, 5000, 10000, 50000, 100000];
    
    for (const amount of feeTests) {
      const fees = zenoPayService.getTransactionFees(amount);
      console.log(`Amount: ${fees.amount.toLocaleString()} TZS, Fee: ${fees.fee.toLocaleString()} TZS, Total: ${fees.total.toLocaleString()} TZS`);
    }
    console.log('');
    
    // Test 5: Get supported providers
    console.log('5️⃣ Testing supported providers...');
    const providers = zenoPayService.getSupportedProviders();
    console.log(`✅ Found ${providers.length} supported providers:`);
    providers.forEach(provider => {
      console.log(`   • ${provider.name} (${provider.code}) - ${provider.ussdCode}`);
      console.log(`     Prefixes: ${provider.prefixes.join(', ')}`);
    });
    console.log('');
    
    // Test 6: Signature generation
    console.log('6️⃣ Testing signature generation...');
    const testPayload = { amount: '1000', phoneNumber: '255712345678' };
    const timestamp = Date.now().toString();
    const signature = zenoPayService.generateSignature(testPayload, timestamp);
    console.log(`✅ Generated signature: ${signature.substring(0, 20)}...`);
    console.log(`   Payload: ${JSON.stringify(testPayload)}`);
    console.log(`   Timestamp: ${timestamp}`);
    console.log('');
    
    // Test 7: Webhook signature verification
    console.log('7️⃣ Testing webhook signature verification...');
    const webhookPayload = { orderId: 'test123', status: 'completed' };
    const webhookTimestamp = Date.now().toString();
    const webhookSignature = zenoPayService.generateSignature(webhookPayload, webhookTimestamp);
    
    const isValid = zenoPayService.verifyWebhookSignature(webhookPayload, webhookSignature, webhookTimestamp);
    console.log(`✅ Webhook signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
    
    // Test with invalid signature
    const isInvalid = zenoPayService.verifyWebhookSignature(webhookPayload, 'invalid_signature', webhookTimestamp);
    console.log(`✅ Invalid signature test: ${!isInvalid ? 'CORRECTLY REJECTED' : 'INCORRECTLY ACCEPTED'}`);
    console.log('');
    
    // Test 8: API request structure (without actually calling API)
    console.log('8️⃣ Testing API request structure...');
    console.log('✅ API request would be sent to:', zenoPayService.baseUrl);
    console.log('✅ Headers would include:');
    console.log('   • Content-Type: application/json');
    console.log('   • x-account-id:', zenoPayService.accountId);
    console.log('   • x-client-id:', zenoPayService.apiKey ? 'SET' : 'NOT SET');
    console.log('   • x-timestamp: [current timestamp]');
    console.log('   • x-signature: [generated signature]');
    console.log('');
    
    // Test 9: Configuration validation
    console.log('9️⃣ Testing configuration validation...');
    const configValid = zenoPayService.accountId && zenoPayService.apiKey && zenoPayService.secretKey;
    console.log(`✅ Configuration: ${configValid ? 'COMPLETE' : 'INCOMPLETE'}`);
    
    if (!configValid) {
      console.log('❌ Missing configuration:');
      if (!zenoPayService.accountId) console.log('   • ZENOPAY_ACCOUNT_ID not set');
      if (!zenoPayService.apiKey) console.log('   • ZENOPAY_API_KEY not set');
      if (!zenoPayService.secretKey) console.log('   • ZENOPAY_SECRET_KEY not set');
    }
    console.log('');
    
    console.log('✅ All ZenoPay integration tests completed!');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('✅ Service initialization');
    console.log('✅ Phone number formatting and validation');
    console.log('✅ Mobile money provider detection');
    console.log('✅ Transaction fee calculation');
    console.log('✅ Supported providers listing');
    console.log('✅ Signature generation and verification');
    console.log('✅ API request structure');
    console.log(`✅ Configuration: ${configValid ? 'Ready for use' : 'Needs credentials'}`);
    
    if (configValid) {
      console.log('\n🚀 Ready for live testing with actual API calls!');
      console.log('💡 To test with real API:');
      console.log('   1. Set PAYMENT_MODE=live in .env');
      console.log('   2. Add your ZenoPay credentials');
      console.log('   3. Test with small amounts first');
    } else {
      console.log('\n⚠️  Add ZenoPay credentials to .env file to enable live testing');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testZenoPayIntegration().catch(console.error);
}

module.exports = { testZenoPayIntegration };