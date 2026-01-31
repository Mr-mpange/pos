#!/usr/bin/env node

/**
 * Test the actual AI service with "mambo vipi"
 */

const { generateReply } = require('./src/services/ai');

async function testLiveAI() {
  console.log('🧪 Testing Live AI Service with "mambo vipi"\n');
  
  const testPhone = '+255683859574';
  const testMessage = 'mambo vipi';
  
  try {
    console.log(`Input: "${testMessage}"`);
    console.log(`Phone: ${testPhone}`);
    console.log('Generating AI reply...\n');
    
    const response = await generateReply(testMessage, testPhone);
    
    console.log(`Response: "${response}"`);
    console.log(`Length: ${response.length} characters`);
    console.log(`SMS-friendly: ${response.length <= 160 ? '✅' : '❌'}`);
    console.log(`Service-focused: ${response.includes('shop') || response.includes('balance') || response.includes('Soko') ? '✅' : '❌'}`);
    
    // Test a few more cases
    console.log('\n📱 Testing other cases:');
    const testCases = [
      'hi',
      'niko salama',
      'shop',
      'balance',
      'habari, nataka kununua'
    ];
    
    for (const testCase of testCases) {
      try {
        const resp = await generateReply(testCase, testPhone);
        console.log(`"${testCase}" → "${resp.substring(0, 60)}${resp.length > 60 ? '...' : ''}" (${resp.length} chars)`);
      } catch (error) {
        console.log(`"${testCase}" → ERROR: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing AI service:', error.message);
    
    if (error.message.includes('GEMINI_API_KEY')) {
      console.log('\n💡 The AI service requires a valid GEMINI_API_KEY to work.');
      console.log('However, the off-topic detection and redirect logic should still work.');
      console.log('The system will fall back to predefined service-focused responses.');
    }
  }
  
  console.log('\n✅ Test completed!');
}

// Run the test
if (require.main === module) {
  testLiveAI().catch(console.error);
}

module.exports = { testLiveAI };