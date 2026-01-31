#!/usr/bin/env node

/**
 * Test script for individual item removal and AI system flow
 */

const POSService = require('./src/services/pos');
const { generateReply } = require('./src/services/ai');

// Mock MarketplaceService for testing
const MarketplaceService = POSService;

async function testCartManagement() {
  console.log('🧪 Testing Individual Item Removal and AI Flow\n');
  
  const testPhone = '+255123456789';
  
  try {
    // Clear any existing cart
    MarketplaceService.clearCart(testPhone);
    
    // Test 1: Welcome new user
    console.log('1️⃣ Testing welcome flow for new user...');
    let response = await generateReply('Hi', testPhone);
    console.log(`User: Hi`);
    console.log(`Maya: ${response}\n`);
    
    // Test 2: Guide user to browse
    console.log('2️⃣ Testing browse guidance...');
    response = await generateReply('shop', testPhone);
    console.log(`User: shop`);
    console.log(`Maya: ${response}\n`);
    
    // Test 3: Add multiple items to cart
    console.log('3️⃣ Adding items to cart...');
    
    // Mock some products for testing
    const mockProducts = [
      { id: '001', name: 'Bread', price: 2000, unit: 'loaf', stock: 10, vendorName: 'Bakery Shop' },
      { id: '002', name: 'Milk', price: 3000, unit: 'liter', stock: 5, vendorName: 'Dairy Farm' },
      { id: '003', name: 'Rice', price: 5000, unit: 'kg', stock: 20, vendorName: 'Grain Store' }
    ];
    
    // Simulate adding products
    for (const product of mockProducts) {
      const addResult = await MarketplaceService.addToCart(testPhone, product.id, 1);
      console.log(`Added ${product.name}: ${addResult.message}`);
    }
    
    response = await generateReply('add bread', testPhone);
    console.log(`User: add bread`);
    console.log(`Maya: ${response}\n`);
    
    // Test 4: View formatted cart with item numbers
    console.log('4️⃣ Testing formatted cart view...');
    const cartResult = MarketplaceService.getFormattedCart(testPhone);
    console.log('Formatted Cart:');
    console.log(cartResult.message);
    console.log('');
    
    response = await generateReply('cart', testPhone);
    console.log(`User: cart`);
    console.log(`Maya: ${response}\n`);
    
    // Test 5: Remove item by index
    console.log('5️⃣ Testing remove by index...');
    response = await generateReply('remove 2', testPhone);
    console.log(`User: remove 2`);
    console.log(`Maya: ${response}\n`);
    
    // Test 6: Remove item by name
    console.log('6️⃣ Testing remove by name...');
    response = await generateReply('remove bread', testPhone);
    console.log(`User: remove bread`);
    console.log(`Maya: ${response}\n`);
    
    // Test 7: View cart after removals
    console.log('7️⃣ Checking cart after removals...');
    const updatedCart = MarketplaceService.getFormattedCart(testPhone);
    console.log('Updated Cart:');
    console.log(updatedCart.message);
    console.log('');
    
    // Test 8: Test checkout guidance
    console.log('8️⃣ Testing checkout guidance...');
    response = await generateReply('checkout', testPhone);
    console.log(`User: checkout`);
    console.log(`Maya: ${response}\n`);
    
    // Test 9: Test help command
    console.log('9️⃣ Testing help command...');
    response = await generateReply('help', testPhone);
    console.log(`User: help`);
    console.log(`Maya: ${response}\n`);
    
    // Test 10: Test error handling for invalid removal
    console.log('🔟 Testing invalid item removal...');
    response = await generateReply('remove 10', testPhone);
    console.log(`User: remove 10`);
    console.log(`Maya: ${response}\n`);
    
    // Test 11: Clear cart and test guidance
    console.log('1️⃣1️⃣ Testing clear cart and guidance...');
    response = await generateReply('clear', testPhone);
    console.log(`User: clear`);
    console.log(`Maya: ${response}\n`);
    
    // Test 12: Test guidance for empty cart
    console.log('1️⃣2️⃣ Testing guidance for empty cart...');
    response = await generateReply('what should I do?', testPhone);
    console.log(`User: what should I do?`);
    console.log(`Maya: ${response}\n`);
    
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Mock the MarketplaceService methods for testing
MarketplaceService.getProduct = async (productId) => {
  const products = {
    '001': { id: '001', name: 'Bread', price: 2000, unit: 'loaf', stock: 10, vendorName: 'Bakery Shop' },
    '002': { id: '002', name: 'Milk', price: 3000, unit: 'liter', stock: 5, vendorName: 'Dairy Farm' },
    '003': { id: '003', name: 'Rice', price: 5000, unit: 'kg', stock: 20, vendorName: 'Grain Store' }
  };
  return products[productId] || null;
};

MarketplaceService.getProducts = async () => {
  return [
    { id: '001', name: 'Bread', price: 2000, unit: 'loaf', stock: 10, vendorName: 'Bakery Shop' },
    { id: '002', name: 'Milk', price: 3000, unit: 'liter', stock: 5, vendorName: 'Dairy Farm' },
    { id: '003', name: 'Rice', price: 5000, unit: 'kg', stock: 20, vendorName: 'Grain Store' }
  ];
};

MarketplaceService.searchProducts = async (query) => {
  const allProducts = await MarketplaceService.getProducts();
  return allProducts.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
};

MarketplaceService.processCheckout = async (phoneNumber) => {
  const cart = MarketplaceService.getCart(phoneNumber);
  if (cart.items.length === 0) {
    return { success: false, message: 'Cart is empty' };
  }
  return { 
    success: true, 
    message: `Payment request sent to ${phoneNumber}. Please check your phone and enter PIN to confirm payment of ${cart.total} TZS`,
    orderId: `TEST${Date.now()}`
  };
};

MarketplaceService.getOrderHistory = (phoneNumber, limit = 5) => {
  return []; // Empty for testing
};

// Run the test
if (require.main === module) {
  testCartManagement().catch(console.error);
}

module.exports = { testCartManagement };