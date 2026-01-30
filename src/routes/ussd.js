const express = require('express');
const at = require('../config/at');
const POSService = require('../services/pos');
const PaymentService = require('../services/payments');

const router = express.Router();

// USSD session storage (in production, use Redis or database)
const ussdSessions = new Map();

// USSD menu structure
const MENUS = {
  MAIN: 'main',
  SHOP: 'shop',
  CART: 'cart',
  WALLET: 'wallet',
  PRODUCT_LIST: 'product_list',
  ADD_PRODUCT: 'add_product',
  CHECKOUT: 'checkout',
  BALANCE: 'balance',
  SEND_MONEY: 'send_money'
};

function getSession(sessionId, phoneNumber) {
  // Use phoneNumber as consistent session key to handle changing sessionIds
  const sessionKey = phoneNumber;
  
  if (!ussdSessions.has(sessionKey)) {
    ussdSessions.set(sessionKey, {
      phoneNumber,
      menu: MENUS.MAIN,
      data: {},
      step: 0,
      lastActivity: Date.now()
    });
    // Auto-register user for payments
    PaymentService.registerUser(phoneNumber);
  }
  
  // Update last activity
  const session = ussdSessions.get(sessionKey);
  session.lastActivity = Date.now();
  
  return session;
}

function clearSession(sessionId, phoneNumber) {
  // Clear by phoneNumber instead of sessionId
  ussdSessions.delete(phoneNumber);
}

function buildMainMenu() {
  return `CON Welcome to POS Store
1. Shop Products
2. View Cart
3. Wallet
4. Order History
0. Exit`;
}

function buildShopMenu() {
  return `CON Shop Menu
1. Browse All Products
2. Search Products
3. View Categories
4. Back to Main Menu`;
}

function buildWalletMenu() {
  return `CON Wallet Menu
1. Check Balance
2. Send Money
3. Transaction History
4. Add Money (Demo)
0. Back to Main Menu`;
}

function buildProductList(products, page = 1, itemsPerPage = 5) {
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageProducts = products.slice(startIndex, endIndex);
  
  let menu = `CON Products (Page ${page}):\n`;
  pageProducts.forEach((product, index) => {
    const menuIndex = startIndex + index + 1;
    menu += `${menuIndex}. ${product.name} - ${product.price} TZS\n`;
  });
  
  if (endIndex < products.length) {
    menu += `${itemsPerPage + 1}. Next Page\n`;
  }
  if (page > 1) {
    menu += `${itemsPerPage + 2}. Previous Page\n`;
  }
  menu += `0. Back to Shop Menu`;
  
  return menu;
}

function buildCartView(cart) {
  console.log('[USSD] Cart contents:', JSON.stringify(cart, null, 2));
  
  if (cart.items.length === 0) {
    return `CON Your cart is empty
1. Go Shopping
0. Back to Main Menu`;
  }
  
  let menu = `CON Your Cart:\n`;
  cart.items.forEach((item, index) => {
    menu += `${index + 1}. ${item.quantity}x ${item.name} - ${item.subtotal} TZS\n`;
  });
  menu += `\nTotal: ${cart.total} TZS\n`;
  menu += `${cart.items.length + 1}. Checkout\n`;
  menu += `${cart.items.length + 2}. Clear Cart\n`;
  menu += `0. Back to Main Menu`;
  
  return menu;
}

// POST /ussd - USSD webhook
router.post('/', async (req, res) => {
  try {
    let { sessionId, serviceCode, phoneNumber, text } = req.body;
    
    // Handle empty sessionId by creating one
    if (!sessionId || sessionId === '') {
      sessionId = `session_${phoneNumber}_${Date.now()}`;
    }
    
    console.log('[USSD]', { sessionId, serviceCode, phoneNumber, text });
    
    const session = getSession(sessionId, phoneNumber);
    const textArray = text ? text.split('*') : [];
    const lastInput = textArray.length > 0 ? textArray[textArray.length - 1] : '';
    
    let response = '';
    
    // Main menu - first time (empty text)
    if (text === '') {
      response = buildMainMenu();
      session.menu = MENUS.MAIN;
    }
    
    // Level 1: Main menu selections (text = "1", "2", "3", "4", "0")
    else if (textArray.length === 1) {
      switch (lastInput) {
        case '1': // Shop Products
          response = buildShopMenu();
          session.menu = MENUS.SHOP;
          break;
          
        case '2': // View Cart
          const cart = POSService.getCart(phoneNumber);
          response = buildCartView(cart);
          session.menu = MENUS.CART;
          break;
          
        case '3': // Wallet
          response = buildWalletMenu();
          session.menu = MENUS.WALLET;
          break;
          
        case '4': // Order History
          const orders = POSService.getOrderHistory(phoneNumber, 3);
          if (orders.length === 0) {
            response = `END No previous orders found.`;
          } else {
            response = `END Recent Orders:\n`;
            orders.forEach(order => {
              response += `${order.id}: ${order.total} TZS (${order.items.length} items)\n`;
            });
          }
          clearSession(sessionId, phoneNumber);
          break;
          
        case '0': // Exit
          response = `END Thank you for using POS Store!`;
          clearSession(sessionId, phoneNumber);
          break;
          
        default:
          response = `END Invalid selection. Please try again.`;
          clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 2: Shop menu selections (text = "1*1", "1*2", "1*3", "1*4")
    else if (textArray.length === 2 && textArray[0] === '1') {
      switch (lastInput) {
        case '1': // Browse All Products
          const products = POSService.getProducts();
          response = buildProductList(products);
          session.menu = MENUS.PRODUCT_LIST;
          session.data.products = products;
          session.data.page = 1;
          break;
          
        case '2': // Search Products
          response = `CON Enter product name to search:`;
          session.menu = 'search_input';
          break;
          
        case '3': // View Categories
          const categories = POSService.getCategories();
          response = `CON Categories:\n`;
          categories.forEach((cat, index) => {
            response += `${index + 1}. ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n`;
          });
          response += `0. Back to Shop Menu`;
          session.menu = 'categories';
          session.data.categories = categories;
          break;
          
        case '4': // Back to Main Menu
          response = buildMainMenu();
          session.menu = MENUS.MAIN;
          break;
          
        default:
          response = `END Invalid selection.`;
          clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 2: Wallet menu selections (text = "3*1", "3*2", "3*3", "3*4")
    else if (textArray.length === 2 && textArray[0] === '3') {
      switch (lastInput) {
        case '1': // Check Balance
          const balance = PaymentService.getBalance(phoneNumber);
          response = `END Your balance: ${balance.balance} ${balance.currency}`;
          clearSession(sessionId, phoneNumber);
          break;
          
        case '2': // Send Money
          response = `CON Enter recipient number:
(Format: +255683859574)`;
          session.menu = 'send_money_number';
          break;
          
        case '3': // Transaction History
          const transactions = PaymentService.getTransactions(phoneNumber, 5);
          if (transactions.length === 0) {
            response = `END No recent transactions found.`;
          } else {
            response = `END Recent Transactions:\n`;
            transactions.forEach(tx => {
              const type = tx.from === phoneNumber ? 'Sent' : 'Received';
              const other = tx.from === phoneNumber ? tx.to : tx.from;
              response += `${type} ${tx.amount} TZS ${type === 'Sent' ? 'to' : 'from'} ${other}\n`;
            });
          }
          clearSession(sessionId, phoneNumber);
          break;
          
        case '4': // Add Money (Demo)
          response = `CON Enter amount to add:`;
          session.menu = 'add_money';
          break;
          
        case '0': // Back to Main Menu
          response = buildMainMenu();
          session.menu = MENUS.MAIN;
          break;
          
        default:
          response = `END Invalid selection.`;
          clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 2: Cart menu selections (text = "2*1", "2*2", etc.)
    else if (textArray.length === 2 && textArray[0] === '2') {
      const cart = POSService.getCart(phoneNumber);
      const selection = parseInt(lastInput);
      
      // Handle empty cart - "Go Shopping" option
      if (cart.items.length === 0 && selection === 1) {
        // Go directly to product list
        const products = POSService.getProducts();
        response = buildProductList(products);
        session.menu = MENUS.PRODUCT_LIST;
        session.data.products = products;
        session.data.page = 1;
      }
      else if (selection >= 1 && selection <= cart.items.length) {
        response = `END Item removal not implemented in USSD. Use SMS: "clear"`;
        clearSession(sessionId, phoneNumber);
      }
      else if (selection === cart.items.length + 1) {
        // Checkout
        const checkoutResult = await POSService.processCheckout(phoneNumber);
        response = `END ${checkoutResult.message}`;
        clearSession(sessionId, phoneNumber);
      }
      else if (selection === cart.items.length + 2) {
        // Clear cart
        POSService.clearCart(phoneNumber);
        response = `END Cart cleared successfully.`;
        clearSession(sessionId, phoneNumber);
      }
      else if (selection === 0) {
        // Back to main menu
        response = buildMainMenu();
        session.menu = MENUS.MAIN;
      }
      else {
        response = `END Invalid selection.`;
        clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 2: Cart menu selections (text = "2*1", "2*0", etc.)
    else if (textArray.length === 2 && textArray[0] === '2') {
      const cart = POSService.getCart(phoneNumber);
      const selection = parseInt(lastInput);
      
      // Handle empty cart - "Go Shopping" option
      if (cart.items.length === 0 && selection === 1) {
        // Go directly to product list
        const products = POSService.getProducts();
        response = buildProductList(products);
        session.menu = MENUS.PRODUCT_LIST;
        session.data.products = products;
        session.data.page = 1;
      }
      else if (selection === 0) {
        // Back to main menu
        response = buildMainMenu();
        session.menu = MENUS.MAIN;
      }
      else {
        response = `END Invalid selection.`;
        clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 3: Product list selections (text = "1*1*1", "1*1*2", etc.)
    else if (textArray.length === 3 && textArray[0] === '1' && textArray[1] === '1') {
      const products = session.data.products || POSService.getProducts();
      const page = session.data.page || 1;
      const itemsPerPage = 5;
      const maxItems = Math.min(itemsPerPage, products.length - (page - 1) * itemsPerPage);
      
      const selection = parseInt(lastInput);
      
      if (selection >= 1 && selection <= maxItems) {
        // Add product to cart
        const productIndex = (page - 1) * itemsPerPage + selection - 1;
        const product = products[productIndex];
        const result = POSService.addToCart(phoneNumber, product.id, 1);
        
        // Continue session - show options after adding to cart
        response = `CON ${result.message}

1. Continue Shopping
2. View Cart
3. Checkout
0. Main Menu`;
        session.menu = 'after_add_to_cart';
      }
      else if (selection === itemsPerPage + 1 && (page * itemsPerPage) < products.length) {
        // Next page
        session.data.page = page + 1;
        response = buildProductList(products, page + 1);
      }
      else if (selection === itemsPerPage + 2 && page > 1) {
        // Previous page
        session.data.page = page - 1;
        response = buildProductList(products, page - 1);
      }
      else if (selection === 0) {
        // Back to shop menu
        response = buildShopMenu();
        session.menu = MENUS.SHOP;
      }
      else {
        response = `END Invalid selection.`;
        clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 4: After add to cart selections (text = "1*1*3*1", "1*1*3*2", etc.)
    else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '1') {
      switch (lastInput) {
        case '1': // Continue Shopping
          const products = POSService.getProducts();
          response = buildProductList(products);
          session.menu = MENUS.PRODUCT_LIST;
          session.data.products = products;
          session.data.page = 1;
          break;
          
        case '2': // View Cart
          const cart = POSService.getCart(phoneNumber);
          response = buildCartView(cart);
          session.menu = MENUS.CART;
          break;
          
        case '3': // Checkout
          const checkoutResult = await POSService.processCheckout(phoneNumber);
          response = `END ${checkoutResult.message}`;
          clearSession(sessionId, phoneNumber);
          break;
          
        case '0': // Main Menu
          response = buildMainMenu();
          session.menu = MENUS.MAIN;
          break;
          
        default:
          response = `END Invalid selection.`;
          clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 5: Continue shopping after add to cart (text = "1*1*3*1*2", etc.)
    else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '3' && textArray[3] === '1') {
      // This is continuing shopping after adding to cart
      const products = session.data.products || POSService.getProducts();
      const page = session.data.page || 1;
      const itemsPerPage = 5;
      const maxItems = Math.min(itemsPerPage, products.length - (page - 1) * itemsPerPage);
      
      const selection = parseInt(lastInput);
      
      if (selection >= 1 && selection <= maxItems) {
        // Add another product to cart
        const productIndex = (page - 1) * itemsPerPage + selection - 1;
        const product = products[productIndex];
        const result = POSService.addToCart(phoneNumber, product.id, 1);
        
        // Continue session - show options after adding to cart
        response = `CON ${result.message}

1. Continue Shopping
2. View Cart
3. Checkout
0. Main Menu`;
        session.menu = 'after_add_to_cart';
      }
      else if (selection === itemsPerPage + 1 && (page * itemsPerPage) < products.length) {
        // Next page
        session.data.page = page + 1;
        response = buildProductList(products, page + 1);
      }
      else if (selection === itemsPerPage + 2 && page > 1) {
        // Previous page
        session.data.page = page - 1;
        response = buildProductList(products, page - 1);
      }
      else if (selection === 0) {
        // Back to shop menu
        response = buildShopMenu();
        session.menu = MENUS.SHOP;
      }
      else {
        response = `END Invalid selection.`;
        clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 6: Continue shopping after multiple adds (text = "1*1*3*1*2*2", etc.)
    else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '3' && textArray[3] === '1' && textArray[4] === '2') {
      // This is continuing shopping after adding multiple products
      const products = session.data.products || POSService.getProducts();
      const page = session.data.page || 1;
      const itemsPerPage = 5;
      const maxItems = Math.min(itemsPerPage, products.length - (page - 1) * itemsPerPage);
      
      const selection = parseInt(lastInput);
      
      if (selection >= 1 && selection <= maxItems) {
        // Add another product to cart
        const productIndex = (page - 1) * itemsPerPage + selection - 1;
        const product = products[productIndex];
        const result = POSService.addToCart(phoneNumber, product.id, 1);
        
        // Continue session - show options after adding to cart
        response = `CON ${result.message}

1. Continue Shopping
2. View Cart
3. Checkout
0. Main Menu`;
        session.menu = 'after_add_to_cart';
      }
      else if (selection === itemsPerPage + 1 && (page * itemsPerPage) < products.length) {
        // Next page
        session.data.page = page + 1;
        response = buildProductList(products, page + 1);
      }
      else if (selection === itemsPerPage + 2 && page > 1) {
        // Previous page
        session.data.page = page - 1;
        response = buildProductList(products, page - 1);
      }
      else if (selection === 0) {
        // Back to shop menu
        response = buildShopMenu();
        session.menu = MENUS.SHOP;
      }
      else {
        response = `END Invalid selection.`;
        clearSession(sessionId, phoneNumber);
      }
    }
    
    // Handle after adding to cart menu (session-based fallback for any level)
    else if (session.menu === 'after_add_to_cart') {
      switch (lastInput) {
        case '1': // Continue Shopping
          const products = POSService.getProducts();
          response = buildProductList(products);
          session.menu = MENUS.PRODUCT_LIST;
          session.data.products = products;
          session.data.page = 1;
          break;
          
        case '2': // View Cart
          const cart = POSService.getCart(phoneNumber);
          response = buildCartView(cart);
          session.menu = MENUS.CART;
          break;
          
        case '3': // Checkout
          const checkoutResult = await POSService.processCheckout(phoneNumber);
          response = `END ${checkoutResult.message}`;
          clearSession(sessionId, phoneNumber);
          break;
          
        case '0': // Main Menu
          response = buildMainMenu();
          session.menu = MENUS.MAIN;
          break;
          
        default:
          response = `END Invalid selection.`;
          clearSession(sessionId, phoneNumber);
      }
    }
    
    // Handle product selection when in PRODUCT_LIST menu (session-based fallback)
    else if (session.menu === MENUS.PRODUCT_LIST) {
      const products = session.data.products || POSService.getProducts();
      const page = session.data.page || 1;
      const itemsPerPage = 5;
      const maxItems = Math.min(itemsPerPage, products.length - (page - 1) * itemsPerPage);
      
      const selection = parseInt(lastInput);
      
      if (selection >= 1 && selection <= maxItems) {
        // Add product to cart
        const productIndex = (page - 1) * itemsPerPage + selection - 1;
        const product = products[productIndex];
        const result = POSService.addToCart(phoneNumber, product.id, 1);
        
        // Continue session - show options after adding to cart
        response = `CON ${result.message}

1. Continue Shopping
2. View Cart
3. Checkout
0. Main Menu`;
        session.menu = 'after_add_to_cart';
      }
      else if (selection === itemsPerPage + 1 && (page * itemsPerPage) < products.length) {
        // Next page
        session.data.page = page + 1;
        response = buildProductList(products, page + 1);
      }
      else if (selection === itemsPerPage + 2 && page > 1) {
        // Previous page
        session.data.page = page - 1;
        response = buildProductList(products, page - 1);
      }
      else if (selection === 0) {
        // Back to shop menu
        response = buildShopMenu();
        session.menu = MENUS.SHOP;
      }
      else {
        response = `END Invalid selection.`;
        clearSession(sessionId, phoneNumber);
      }
    }
    
    // Handle cart menu (session-based fallback for any level)
    else if (session.menu === MENUS.CART) {
      const cart = POSService.getCart(phoneNumber);
      const selection = parseInt(lastInput);
      
      if (selection >= 1 && selection <= cart.items.length) {
        response = `END Item removal not implemented in USSD. Use SMS: "clear"`;
        clearSession(sessionId, phoneNumber);
      }
      else if (selection === cart.items.length + 1) {
        // Checkout
        const checkoutResult = await POSService.processCheckout(phoneNumber);
        response = `END ${checkoutResult.message}`;
        clearSession(sessionId, phoneNumber);
      }
      else if (selection === cart.items.length + 2) {
        // Clear cart
        POSService.clearCart(phoneNumber);
        response = `END Cart cleared successfully.`;
        clearSession(sessionId, phoneNumber);
      }
      else if (selection === 0) {
        // Back to main menu
        response = buildMainMenu();
        session.menu = MENUS.MAIN;
      }
      else {
        response = `END Invalid selection.`;
        clearSession(sessionId, phoneNumber);
      }
    }
    
    // Handle special flows (send money, add money)
    else if (session.menu === 'send_money_number') {
      session.data.recipient = lastInput;
      response = `CON Enter amount to send:`;
      session.menu = 'send_money_amount';
    }
    else if (session.menu === 'send_money_amount') {
      const amount = parseInt(lastInput);
      const recipient = session.data.recipient;
      
      if (isNaN(amount) || amount < 100) {
        response = `END Invalid amount. Minimum is 100 TZS.`;
      } else {
        const result = await PaymentService.processPayment(phoneNumber, recipient, amount, 'USSD Transfer');
        response = `END ${result.message}`;
      }
      clearSession(sessionId, phoneNumber);
    }
    else if (session.menu === 'add_money') {
      const amount = parseInt(lastInput);
      if (isNaN(amount) || amount < 100) {
        response = `END Invalid amount. Minimum is 100 TZS.`;
      } else {
        const newBalance = PaymentService.addMoney(phoneNumber, amount);
        response = `END Added ${amount} TZS. New balance: ${newBalance.balance} TZS`;
      }
      clearSession(sessionId, phoneNumber);
    }
    
    // Default fallback
    else {
      console.log('[USSD] Unhandled case:', { textArray, session: session.menu });
      response = `END Invalid selection. Please try again.`;
      clearSession(sessionId, phoneNumber);
    }
    
    console.log('[USSD Response]', response);
    res.set('Content-Type', 'text/plain');
    res.send(response);
    
  } catch (error) {
    console.error('[USSD Error]', error);
    res.set('Content-Type', 'text/plain');
    res.send('END Service temporarily unavailable. Please try again.');
  }
});

module.exports = router;