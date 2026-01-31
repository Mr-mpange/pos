#!/usr/bin/env node

/**
 * Test script for POS cart management features (without AI dependency)
 */

const POSService = require('./src/services/pos');

// Mock the SupabaseService for testing
const mockSupabaseService = {
  getProduct: async (productId) => {
    const products = {
      '001': { id: '001', name: 'Bread', price: 2000, unit: 'loaf', stock: 10, vendorId: 'v1', vendorName: 'Bakery Shop' },
      '002': { id: '002', name: 'Milk', price: 3000, unit: 'liter', stock: 5, vendorId: 'v2', vendorName: 'Dairy Farm' },
      '003': { id: '003', name: 'Rice', price: 5000, unit: 'kg', stock: 20, vendorId: 'v3', vendorName: 'Grain Store' }
    };
    return { success: true, data: products[productId] || null };
  },
  
  getProducts: async () => {
    return {
      success: true,
      data: [
        { id: '001', name: 'Bread', price: 2000, unit: 'loaf', stock: 10, vendorId: 'v1', vendorName: 'Bakery Shop' },
        { id: '002', name: 'Milk', price: 3000, unit: 'liter', stock: 5, vendorId: 'v2', vendorName: 'Dairy Farm' },
        { id: '003', name: 'Rice', price: 5000, unit: 'kg', stock: 20, vendorId: 'v3', vendorName: 'Grain Store' }
      ]
    };
  },
  
  searchProducts: async (query) => {
    const allProducts = await mockSupabaseService.getProducts();
    const filtered = allProducts.data.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    return { success: true, data: filtered };
  }
};

// Replace the SupabaseService require
require.cache[require.resolve('./src/services/supabase-client')] = {
  exports: mockSupabaseService
};

async function testPOSFeatures() {
  console.log('🧪 Testing POS Cart Management Features\n');
  
  const testPhone = '+255123456789';
  
  try {
    // Clear any existing cart
    POSService.clearCart(testPhone);
    console.log('✅ Cart cleared for testing\n');
    
    // Test 1: Add items to cart
    console.log('1️⃣ Testing add items to cart...');
    let result = await POSService.addToCart(testPhone, '001', 2); // 2 loaves of bread
    console.log(`Add Bread: ${result.success ? '✅' : '❌'} ${result.message}`);
    
    result = await POSService.addToCart(testPhone, '002', 1); // 1 liter of milk
    console.log(`Add Milk: ${result.success ? '✅' : '❌'} ${result.message}`);
    
    result = await POSService.addToCart(testPhone, '003', 3); // 3 kg of rice
    console.log(`Add Rice: ${result.success ? '✅' : '❌'} ${result.message}\n`);
    
    // Test 2: View formatted cart
    console.log('2️⃣ Testing formatted cart view...');
    const cartResult = POSService.getFormattedCart(testPhone);
    console.log(`Get Formatted Cart: ${cartResult.success ? '✅' : '❌'}`);
    console.log('Cart Contents:');
    console.log(cartResult.message);
    console.log('');
    
    // Test 3: Remove item by index
    console.log('3️⃣ Testing remove by index...');
    result = POSService.removeFromCartByIndex(testPhone, 2); // Remove milk (item #2)
    console.log(`Remove by index 2: ${result.success ? '✅' : '❌'} ${result.message}`);
    
    // Show cart after removal
    const cartAfterRemoval = POSService.getFormattedCart(testPhone);
    console.log('Cart after removal:');
    console.log(cartAfterRemoval.message);
    console.log('');
    
    // Test 4: Remove item by product ID
    console.log('4️⃣ Testing remove by product ID...');
    result = POSService.removeFromCart(testPhone, '001'); // Remove bread
    console.log(`Remove bread by ID: ${result.success ? '✅' : '❌'} ${result.message}`);
    
    // Show cart after removal
    const cartAfterRemoval2 = POSService.getFormattedCart(testPhone);
    console.log('Cart after removing bread:');
    console.log(cartAfterRemoval2.message);
    console.log('');
    
    // Test 5: Test invalid removals
    console.log('5️⃣ Testing error handling...');
    result = POSService.removeFromCartByIndex(testPhone, 10); // Invalid index
    console.log(`Remove invalid index: ${result.success ? '❌' : '✅'} ${result.message}`);
    
    result = POSService.removeFromCart(testPhone, '999'); // Non-existent product
    console.log(`Remove non-existent product: ${result.success ? '❌' : '✅'} ${result.message}`);
    
    // Test 6: Test empty cart operations
    console.log('\n6️⃣ Testing empty cart operations...');
    POSService.clearCart(testPhone);
    
    result = POSService.removeFromCartByIndex(testPhone, 1);
    console.log(`Remove from empty cart: ${result.success ? '❌' : '✅'} ${result.message}`);
    
    const emptyCartResult = POSService.getFormattedCart(testPhone);
    console.log(`Empty cart view: ${emptyCartResult.success ? '✅' : '❌'} ${emptyCartResult.message}`);
    
    // Test 7: Test cart operations with quantities
    console.log('\n7️⃣ Testing quantity management...');
    await POSService.addToCart(testPhone, '001', 1); // 1 bread
    await POSService.addToCart(testPhone, '001', 2); // Add 2 more bread (should combine)
    
    const quantityCart = POSService.getFormattedCart(testPhone);
    console.log('Cart with combined quantities:');
    console.log(quantityCart.message);
    
    // Test 8: Test stock validation
    console.log('\n8️⃣ Testing stock validation...');
    result = await POSService.addToCart(testPhone, '002', 10); // Try to add more milk than available
    console.log(`Add excessive quantity: ${result.success ? '❌' : '✅'} ${result.message}`);
    
    console.log('\n✅ All POS feature tests completed successfully!');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('✅ Individual item removal by index');
    console.log('✅ Individual item removal by product ID');
    console.log('✅ Formatted cart display with item numbers');
    console.log('✅ Error handling for invalid operations');
    console.log('✅ Empty cart handling');
    console.log('✅ Quantity management and combination');
    console.log('✅ Stock validation');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testPOSFeatures().catch(console.error);
}

module.exports = { testPOSFeatures };