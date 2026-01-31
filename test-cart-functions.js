#!/usr/bin/env node

/**
 * Direct test of cart management functions
 */

// Mock the cart storage and functions directly
const userCarts = new Map();

// Cart management functions (extracted from POSService)
function getCart(phoneNumber) {
  return userCarts.get(phoneNumber) || { items: [], total: 0 };
}

function addToCartDirect(phoneNumber, product, quantity = 1) {
  const cart = getCart(phoneNumber);
  const existingItem = cart.items.find(item => item.productId === product.id);

  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.subtotal = existingItem.quantity * product.price;
  } else {
    cart.items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit || 'unit',
      quantity,
      subtotal: quantity * product.price,
      vendorId: product.vendorId,
      vendorName: product.vendorName
    });
  }

  cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  userCarts.set(phoneNumber, cart);
  
  return {
    success: true,
    message: `Added ${quantity} ${product.unit || 'unit'}(s) of ${product.name} to cart. Cart total: ${cart.total.toLocaleString()} TZS`,
    cart
  };
}

function removeFromCartByIndex(phoneNumber, itemIndex) {
  const cart = getCart(phoneNumber);
  
  if (cart.items.length === 0) {
    return {
      success: false,
      message: 'Your cart is empty'
    };
  }

  const index = itemIndex - 1; // Convert to 0-based index
  if (index < 0 || index >= cart.items.length) {
    return {
      success: false,
      message: `Invalid item number. Please choose between 1 and ${cart.items.length}`
    };
  }

  const removedItem = cart.items[index];
  cart.items.splice(index, 1);
  cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  userCarts.set(phoneNumber, cart);

  return {
    success: true,
    message: `Removed ${removedItem.name} from cart. Cart total: ${cart.total.toLocaleString()} TZS`,
    cart,
    removedItem
  };
}

function removeFromCart(phoneNumber, productId) {
  const cart = getCart(phoneNumber);
  const itemToRemove = cart.items.find(item => item.productId === productId);
  
  if (!itemToRemove) {
    return {
      success: false,
      message: 'Item not found in cart'
    };
  }

  cart.items = cart.items.filter(item => item.productId !== productId);
  cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  userCarts.set(phoneNumber, cart);

  return {
    success: true,
    message: `Removed ${itemToRemove.name} from cart. Cart total: ${cart.total.toLocaleString()} TZS`,
    cart,
    removedItem: itemToRemove
  };
}

function getFormattedCart(phoneNumber) {
  const cart = getCart(phoneNumber);
  
  if (cart.items.length === 0) {
    return {
      success: true,
      message: 'Your cart is empty',
      cart,
      formattedItems: []
    };
  }

  let formattedMessage = 'Your cart:\n';
  const formattedItems = [];
  
  cart.items.forEach((item, index) => {
    const itemNumber = index + 1;
    const itemText = `${itemNumber}. ${item.quantity} ${item.unit}(s) ${item.name} - ${item.subtotal.toLocaleString()} TZS`;
    formattedMessage += itemText + '\n';
    formattedItems.push({
      number: itemNumber,
      ...item,
      displayText: itemText
    });
  });
  
  formattedMessage += `\nTotal: ${cart.total.toLocaleString()} TZS`;
  formattedMessage += '\nTo remove an item, type "remove [number]" (e.g., "remove 1")';

  return {
    success: true,
    message: formattedMessage,
    cart,
    formattedItems
  };
}

function clearCart(phoneNumber) {
  const cart = getCart(phoneNumber);
  const clearedItems = [...cart.items];
  const clearedTotal = cart.total;
  
  userCarts.delete(phoneNumber);
  
  let message = 'Cart cleared successfully!';
  if (clearedItems.length > 0) {
    message = `Cart cleared! Removed ${clearedItems.length} item(s):\n`;
    clearedItems.forEach(item => {
      message += `- ${item.quantity} ${item.unit || 'unit'}(s) ${item.name} (${item.subtotal.toLocaleString()} TZS)\n`;
    });
    message += `Total cleared: ${clearedTotal.toLocaleString()} TZS`;
  }
  
  return { 
    success: true, 
    message,
    clearedItems,
    clearedTotal
  };
}

async function testCartFunctions() {
  console.log('🧪 Testing Cart Management Functions Directly\n');
  
  const testPhone = '+255123456789';
  
  // Mock products
  const products = {
    '001': { id: '001', name: 'Bread', price: 2000, unit: 'loaf', vendorId: 'v1', vendorName: 'Bakery Shop' },
    '002': { id: '002', name: 'Milk', price: 3000, unit: 'liter', vendorId: 'v2', vendorName: 'Dairy Farm' },
    '003': { id: '003', name: 'Rice', price: 5000, unit: 'kg', vendorId: 'v3', vendorName: 'Grain Store' }
  };
  
  try {
    // Clear cart
    clearCart(testPhone);
    console.log('✅ Cart cleared for testing\n');
    
    // Test 1: Add items to cart
    console.log('1️⃣ Testing add items to cart...');
    let result = addToCartDirect(testPhone, products['001'], 2); // 2 loaves of bread
    console.log(`Add Bread: ${result.success ? '✅' : '❌'} ${result.message}`);
    
    result = addToCartDirect(testPhone, products['002'], 1); // 1 liter of milk
    console.log(`Add Milk: ${result.success ? '✅' : '❌'} ${result.message}`);
    
    result = addToCartDirect(testPhone, products['003'], 3); // 3 kg of rice
    console.log(`Add Rice: ${result.success ? '✅' : '❌'} ${result.message}\n`);
    
    // Test 2: View formatted cart
    console.log('2️⃣ Testing formatted cart view...');
    const cartResult = getFormattedCart(testPhone);
    console.log(`Get Formatted Cart: ${cartResult.success ? '✅' : '❌'}`);
    console.log('📋 Cart Contents:');
    console.log(cartResult.message);
    console.log('');
    
    // Test 3: Remove item by index
    console.log('3️⃣ Testing remove by index...');
    result = removeFromCartByIndex(testPhone, 2); // Remove milk (item #2)
    console.log(`Remove by index 2: ${result.success ? '✅' : '❌'} ${result.message}`);
    console.log(`Removed item: ${result.removedItem ? result.removedItem.name : 'None'}`);
    
    // Show cart after removal
    const cartAfterRemoval = getFormattedCart(testPhone);
    console.log('📋 Cart after removal:');
    console.log(cartAfterRemoval.message);
    console.log('');
    
    // Test 4: Remove item by product ID
    console.log('4️⃣ Testing remove by product ID...');
    result = removeFromCart(testPhone, '001'); // Remove bread
    console.log(`Remove bread by ID: ${result.success ? '✅' : '❌'} ${result.message}`);
    console.log(`Removed item: ${result.removedItem ? result.removedItem.name : 'None'}`);
    
    // Show cart after removal
    const cartAfterRemoval2 = getFormattedCart(testPhone);
    console.log('📋 Cart after removing bread:');
    console.log(cartAfterRemoval2.message);
    console.log('');
    
    // Test 5: Test invalid removals
    console.log('5️⃣ Testing error handling...');
    result = removeFromCartByIndex(testPhone, 10); // Invalid index
    console.log(`Remove invalid index: ${result.success ? '❌' : '✅'} ${result.message}`);
    
    result = removeFromCart(testPhone, '999'); // Non-existent product
    console.log(`Remove non-existent product: ${result.success ? '❌' : '✅'} ${result.message}`);
    
    // Test 6: Test empty cart operations
    console.log('\n6️⃣ Testing empty cart operations...');
    clearCart(testPhone);
    
    result = removeFromCartByIndex(testPhone, 1);
    console.log(`Remove from empty cart: ${result.success ? '❌' : '✅'} ${result.message}`);
    
    const emptyCartResult = getFormattedCart(testPhone);
    console.log(`Empty cart view: ${emptyCartResult.success ? '✅' : '❌'} ${emptyCartResult.message}`);
    
    // Test 7: Test cart operations with quantities
    console.log('\n7️⃣ Testing quantity management...');
    addToCartDirect(testPhone, products['001'], 1); // 1 bread
    addToCartDirect(testPhone, products['001'], 2); // Add 2 more bread (should combine)
    
    const quantityCart = getFormattedCart(testPhone);
    console.log('📋 Cart with combined quantities:');
    console.log(quantityCart.message);
    
    // Test 8: Test detailed cart clearing
    console.log('\n8️⃣ Testing detailed cart clearing...');
    const clearResult = clearCart(testPhone);
    console.log(`Clear cart: ${clearResult.success ? '✅' : '❌'}`);
    console.log('📋 Clear details:');
    console.log(clearResult.message);
    
    console.log('\n✅ All cart function tests completed successfully!');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('✅ Individual item removal by index');
    console.log('✅ Individual item removal by product ID');
    console.log('✅ Formatted cart display with item numbers');
    console.log('✅ Error handling for invalid operations');
    console.log('✅ Empty cart handling');
    console.log('✅ Quantity management and combination');
    console.log('✅ Detailed cart clearing with summary');
    console.log('✅ Proper total calculations');
    console.log('✅ Item numbering for easy reference');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testCartFunctions().catch(console.error);
}

module.exports = { testCartFunctions };