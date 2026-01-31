#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

function switchPaymentMode(mode) {
  if (!['sandbox', 'live'].includes(mode)) {
    console.error('❌ Invalid mode. Use "sandbox" or "live"');
    process.exit(1);
  }

  try {
    // Read current .env file
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update PAYMENT_MODE
    if (envContent.includes('PAYMENT_MODE=')) {
      envContent = envContent.replace(/PAYMENT_MODE=.*/g, `PAYMENT_MODE=${mode}`);
    } else {
      envContent += `\nPAYMENT_MODE=${mode}\n`;
    }
    
    // Write back to .env
    fs.writeFileSync(envPath, envContent);
    
    console.log(`✅ Payment mode switched to: ${mode.toUpperCase()}`);
    
    if (mode === 'sandbox') {
      console.log('🧪 SANDBOX MODE:');
      console.log('   - Payments are simulated');
      console.log('   - No real money is charged');
      console.log('   - Auto-confirmation after 3 seconds');
      console.log('   - 90% success rate by default');
    } else {
      console.log('💰 LIVE MODE:');
      console.log('   - Real payments will be processed');
      console.log('   - Actual money will be charged');
      console.log('   - Requires live payment gateway configuration');
      console.log('   - ⚠️  Make sure LIVE_PAYMENT_* variables are set');
    }
    
    console.log('\n🔄 Restart the server to apply changes: npm start');
    
  } catch (error) {
    console.error('❌ Error updating .env file:', error.message);
    process.exit(1);
  }
}

// Get command line argument
const mode = process.argv[2];

if (!mode) {
  console.log('💳 Payment Mode Switcher');
  console.log('');
  console.log('Usage: node switch-payment-mode.js <mode>');
  console.log('');
  console.log('Modes:');
  console.log('  sandbox  - Use simulated payments (safe for testing)');
  console.log('  live     - Use real payments (production)');
  console.log('');
  console.log('Examples:');
  console.log('  node switch-payment-mode.js sandbox');
  console.log('  node switch-payment-mode.js live');
  process.exit(0);
}

switchPaymentMode(mode);