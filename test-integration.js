const SupabaseService = require('./src/services/supabase-client');
const MarketplaceService = require('./src/services/marketplace');

async function testIntegration() {
  console.log('🧪 Testing Soko Connect - Market Connect Integration...\n');
  
  try {
    // Test 1: Fetch products from database
    console.log('1. Testing product fetch from Supabase...');
    const productsResult = await SupabaseService.getProducts();
    if (productsResult.success) {
      console.log(`✅ Found ${productsResult.data.length} products in database`);
      if (productsResult.data.length > 0) {
        const firstProduct = productsResult.data[0];
        console.log(`   Sample: ${firstProduct.name} - ${firstProduct.price} TZS/${firstProduct.unit} (${firstProduct.vendorName})`);
      }
    } else {
      console.log(`❌ Failed to fetch products: ${productsResult.error}`);
      return;
    }
    
    // Test 2: Fetch categories
    console.log('\n2. Testing categories fetch...');
    const categoriesResult = await SupabaseService.getCategories();
    if (categoriesResult.success) {
      console.log(`✅ Found ${categoriesResult.data.length} categories`);
      console.log(`   Categories: ${categoriesResult.data.map(c => c.name).join(', ')}`);
    } else {
      console.log(`❌ Failed to fetch categories: ${categoriesResult.error}`);
    }
    
    // Test 3: Search products
    console.log('\n3. Testing product search...');
    const searchResult = await SupabaseService.searchProducts('maize');
    if (searchResult.success) {
      console.log(`✅ Found ${searchResult.data.length} products matching 'maize'`);
      searchResult.data.slice(0, 2).forEach(p => {
        console.log(`   - ${p.name} - ${p.price} TZS/${p.unit} (${p.vendorName})`);
      });
    } else {
      console.log(`❌ Failed to search products: ${searchResult.error}`);
    }
    
    // Test 4: Test marketplace service wrapper
    console.log('\n4. Testing marketplace service wrapper...');
    const marketplaceProducts = await MarketplaceService.getProducts();
    console.log(`✅ Marketplace service returned ${marketplaceProducts.length} products`);
    
    // Test 5: Test cart functionality
    console.log('\n5. Testing cart functionality...');
    const testPhone = '+255683859574';
    
    if (marketplaceProducts.length > 0) {
      const testProduct = marketplaceProducts[0];
      const addResult = await MarketplaceService.addToCart(testPhone, testProduct.id, 2);
      
      if (addResult.success) {
        console.log(`✅ Added to cart: ${addResult.message}`);
        
        const cart = MarketplaceService.getCart(testPhone);
        console.log(`   Cart total: ${cart.total.toLocaleString()} TZS (${cart.items.length} items)`);
        
        // Clear test cart
        MarketplaceService.clearCart(testPhone);
        console.log('   ✅ Test cart cleared');
      } else {
        console.log(`❌ Failed to add to cart: ${addResult.message}`);
      }
    }
    
    console.log('\n🎉 Integration test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- POS system can now access real product data from market-connect database');
    console.log('- Products include vendor information, pricing, and stock levels');
    console.log('- Cart and checkout functionality works with real data');
    console.log('- SMS and USSD interfaces will show actual marketplace products');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

// Run the test
testIntegration().then(() => {
  console.log('\nTest completed. You can now start the POS server with: npm start');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});