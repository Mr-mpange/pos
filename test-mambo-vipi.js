#!/usr/bin/env node

/**
 * Test the specific "mambo vipi" case from the logs
 */

// Mock the required services
const mockMarketplaceService = {
  getCart: (phoneNumber) => ({ items: [], total: 0 })
};

// Mock session management
const userSessions = new Map();
const SESSION_STATES = {
  WELCOME: 'welcome',
  BROWSING: 'browsing',
  ADDING_ITEMS: 'adding_items',
  REVIEWING_CART: 'reviewing_cart',
  READY_TO_CHECKOUT: 'ready_to_checkout',
  PAYMENT_PENDING: 'payment_pending',
  COMPLETED: 'completed'
};

function getUserSession(phoneNumber) {
  if (!userSessions.has(phoneNumber)) {
    userSessions.set(phoneNumber, {
      state: SESSION_STATES.WELCOME,
      lastActivity: Date.now(),
      cartItemsAdded: 0,
      hasViewedCart: false,
      checkoutAttempts: 0
    });
  }
  return userSessions.get(phoneNumber);
}

// Off-topic detection function
function isOffTopicMessage(text) {
  const lowerText = text.toLowerCase().trim();
  
  // First check if message contains shopping/payment intent even with greetings
  const hasShoppingIntent = /shop|buy|kununua|nataka|balance|cart|checkout|search|add|remove|send|pay|history|orders|help|nunua|ununue/.test(lowerText);
  if (hasShoppingIntent) {
    return false; // Don't redirect if there's clear service intent
  }
  
  // Common off-topic patterns (only match if they're standalone)
  const offTopicPatterns = [
    /^(hi|hello|hey|mambo|salama|hujambo)$/,
    /^(how are you|habari yako|u hali gani)$/,
    /^(good morning|good afternoon|good evening)$/,
    /^(thanks|thank you|asante)$/,
    /^(bye|goodbye|kwaheri)$/,
    /^habari$/,
    /weather|hali ya hewa/,
    /^news$/,
    /health|afya/,
    /politics|siasa/,
    /sports|michezo/,
    /^(niko salama|niko poa|poa|safi)$/,
    /vipi/, // Catches "mambo vipi", "habari vipi", etc.
    /^(mambo vipi|habari vipi|hujambo vipi)$/ // Common Swahili casual greetings
  ];
  
  return offTopicPatterns.some(pattern => pattern.test(lowerText));
}

// Service redirect function
function getServiceRedirectResponse(phoneNumber) {
  const cart = mockMarketplaceService.getCart(phoneNumber);
  const session = getUserSession(phoneNumber);
  
  const responses = [
    'Type "shop" or "balance"',
    'Try "shop" or "balance"',
    'Use "shop" or "balance"',
    '"shop" or "balance"?'
  ];
  
  // Choose response based on user state
  if (cart.items.length > 0) {
    return 'Type "cart" or "checkout"';
  } else if (session.cartItemsAdded > 0) {
    return 'Type "shop" or "balance"';
  } else {
    return responses[0]; // Use first response for consistency
  }
}

async function testMamboVipi() {
  console.log('🧪 Testing "mambo vipi" Response\n');
  
  const testPhone = '+255683859574';
  const testMessage = 'mambo vipi';
  
  console.log(`Input: "${testMessage}"`);
  console.log(`Phone: ${testPhone}`);
  
  // Test off-topic detection
  const isOffTopic = isOffTopicMessage(testMessage);
  console.log(`Off-topic detected: ${isOffTopic ? '✅' : '❌'}`);
  
  if (isOffTopic) {
    const response = getServiceRedirectResponse(testPhone);
    console.log(`Response: "${response}"`);
    console.log(`Length: ${response.length} characters`);
    console.log(`SMS-friendly: ${response.length <= 160 ? '✅' : '❌'}`);
    console.log(`Service-focused: ${response.includes('shop') || response.includes('balance') ? '✅' : '❌'}`);
  } else {
    console.log('❌ Message was not detected as off-topic - this is unexpected!');
  }
  
  // Test other similar Swahili greetings
  console.log('\n📱 Testing other Swahili greetings:');
  const swahiliGreetings = [
    'mambo',
    'habari vipi', 
    'hujambo vipi',
    'vipi',
    'mambo bro',
    'habari za leo'
  ];
  
  for (const greeting of swahiliGreetings) {
    const detected = isOffTopicMessage(greeting);
    const response = detected ? getServiceRedirectResponse(testPhone) : 'Would be processed normally';
    console.log(`"${greeting}" → ${detected ? 'REDIRECT' : 'PROCESS'} → "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`);
  }
  
  console.log('\n✅ Test completed!');
}

// Run the test
if (require.main === module) {
  testMamboVipi().catch(console.error);
}

module.exports = { testMamboVipi };