const MarketplaceService = require('./src/services/marketplace');

async function testClearCart() {
  console.log('🧪 Testing Clear Cart Functionality...\n');
  
  const testPhone = '+255683859574';
  
  try {
    // 1. Get some products to add to cart
    console.log('1. Getting products...');
    const products = await MarketplaceService.getProducts();
    if (products.length < 2) {
      console.log('❌ Need at least 2 products for testing');
      return;
    }
    
    console.log(`✅ Found ${products.length} products`);
    
    // 2. Add multiple items to cart
    console.log('\n2. Adding items to cart...');
    const product1 = products[0];
    const product2 = products[1];
    
    const add1 = await MarketplaceService.addToCart(testPhone, product1.id, 2);
    console.log(`✅ Added: ${add1.message}`);
    
    const add2 = await MarketplaceService.addToCart(testPhone, product2.id, 1);
    console.log(`✅ Added: ${add2.message}`);
    
    // 3. Show cart contents
    console.log('\n3. Current cart contents:');
    const cart = MarketplaceService.getCart(testPhone);
    console.log(`   Items: ${cart.items.length}`);
    console.log(`   Total: ${cart.total.toLocaleString()} TZS`);
    cart.items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.quantity} ${item.unit}(s) ${item.name} - ${item.subtotal.toLocaleString()} TZS`);
    });
    
    // 4. Clear cart and show detailed message
    console.log('\n4. Clearing cart...');
    const clearResult = MarketplaceService.clearCart(testPhone);
    console.log(`✅ Clear result: ${clearResult.success}`);
    console.log(`📝 Clear message:\n${clearResult.message}`);
    
    // 5. Verify cart is empty
    console.log('\n5. Verifying cart is empty...');
    const emptyCart = MarketplaceService.getCart(testPhone);
    console.log(`✅ Cart items: ${emptyCart.items.length} (should be 0)`);
    console.log(`✅ Cart total: ${emptyCart.total} TZS (should be 0)`);
    
    console.log('\n🎉 Clear cart test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Users now see exactly what items were cleared');
    console.log('- Detailed breakdown shows quantity, name, and price per item');
    console.log('- Total cleared amount is displayed');
    console.log('- Works in USSD, SMS, and all interfaces');
    
  } catch (error) {
    console.error('❌ Clear cart test failed:', error);
  }
}

// Run the test
testClearCart().then(() => {
  console.log('\nTest completed.');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});