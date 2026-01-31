const express = require('express');
const at = require('../config/at');
const POSService = require('../services/pos');
const MarketplaceService = require('../services/marketplace');
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
      menu: 'language_selection', // Start with language selection
      language: null, // Will be set after language selection
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

function buildMainMenu(lang = 'en') {
  const menus = {
    en: `CON Welcome to Soko Connect
1. Shop Products
2. View Cart
3. Wallet
4. Order History
5. Call to Shop
0. Exit`,
    sw: `CON Karibu Soko Connect
1. Ununua Bidhaa
2. Angalia Kikapu
3. Pochi
4. Historia ya Maagizo
5. Piga Simu Kununua
0. Toka`
  };
  return menus[lang] || menus.en;
}

function buildLanguageMenu() {
  return `CON Choose Language / Chagua Lugha
1. English
2. Kiswahili`;
}

function buildShopMenu(lang = 'en') {
  const menus = {
    en: `CON Shop Menu
1. Browse All Products
2. Search Products
3. View Categories
4. Back to Main Menu`,
    sw: `CON Menyu ya Ununuzi
1. Angalia Bidhaa Zote
2. Tafuta Bidhaa
3. Angalia Makundi
4. Rudi Menyu Kuu`
  };
  return menus[lang] || menus.en;
}

function buildWalletMenu(lang = 'en') {
  const menus = {
    en: `CON Wallet Menu
1. Check Balance
2. Send Money
3. Transaction History
4. Add Money (Demo)
0. Back to Main Menu`,
    sw: `CON Menyu ya Pochi
1. Angalia Salio
2. Tuma Pesa
3. Historia ya Miamala
4. Ongeza Pesa (Jaribio)
0. Rudi Menyu Kuu`
  };
  return menus[lang] || menus.en;
}

function buildProductList(products, page = 1, itemsPerPage = 5, lang = 'en') {
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageProducts = products.slice(startIndex, endIndex);
  
  const labels = {
    en: { 
      title: 'Products',
      nextPage: 'Next Page',
      prevPage: 'Previous Page',
      back: 'Back to Shop Menu'
    },
    sw: {
      title: 'Bidhaa',
      nextPage: 'Ukurasa Unaofuata',
      prevPage: 'Ukurasa Uliopita',
      back: 'Rudi Menyu ya Ununuzi'
    }
  };
  
  const label = labels[lang] || labels.en;
  
  let menu = `CON ${label.title} (${lang === 'sw' ? 'Ukurasa' : 'Page'} ${page}):\n`;
  pageProducts.forEach((product, index) => {
    const menuIndex = startIndex + index + 1;
    const priceFormatted = product.price.toLocaleString();
    menu += `${menuIndex}. ${product.name} - ${priceFormatted} TZS/${product.unit}\n`;
  });
  
  if (endIndex < products.length) {
    menu += `${itemsPerPage + 1}. ${label.nextPage}\n`;
  }
  if (page > 1) {
    menu += `${itemsPerPage + 2}. ${label.prevPage}\n`;
  }
  menu += `0. ${label.back}`;
  
  return menu;
}

function buildCartView(cart, lang = 'en') {
  console.log('[USSD] Cart contents:', JSON.stringify(cart, null, 2));
  
  const labels = {
    en: {
      empty: 'Your cart is empty',
      goShopping: 'Go Shopping',
      backMain: 'Back to Main Menu',
      cartTitle: 'Your Cart:',
      total: 'Total:',
      checkout: 'Checkout',
      clearCart: 'Clear Cart'
    },
    sw: {
      empty: 'Kikapu chako ni tupu',
      goShopping: 'Nenda Ununuzi',
      backMain: 'Rudi Menyu Kuu',
      cartTitle: 'Kikapu Chako:',
      total: 'Jumla:',
      checkout: 'Lipa',
      clearCart: 'Safisha Kikapu'
    }
  };
  
  const label = labels[lang] || labels.en;
  
  if (cart.items.length === 0) {
    return `CON ${label.empty}
1. ${label.goShopping}
0. ${label.backMain}`;
  }
  
  let menu = `CON ${label.cartTitle}\n`;
  cart.items.forEach((item, index) => {
    const subtotalFormatted = item.subtotal.toLocaleString();
    menu += `${index + 1}. ${item.quantity} ${item.unit}(s) ${item.name} - ${subtotalFormatted} TZS\n`;
  });
  menu += `\n${label.total} ${cart.total.toLocaleString()} TZS\n`;
  menu += `${cart.items.length + 1}. ${label.checkout}\n`;
  menu += `${cart.items.length + 2}. ${label.clearCart}\n`;
  menu += `0. ${label.backMain}`;
  
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
    
    console.log('[USSD Debug]', { 
      textArray, 
      lastInput, 
      sessionMenu: session.menu, 
      sessionData: Object.keys(session.data || {}),
      textLength: textArray.length 
    });
    
    let response = '';
    
    // Language selection - first time user
    if (text === '' || session.menu === 'language_selection') {
      if (text === '') {
        response = buildLanguageMenu();
        session.menu = 'language_selection';
      } else if (textArray.length === 1) {
        // Handle language selection
        if (lastInput === '1') {
          session.language = 'en';
          response = buildMainMenu('en');
          session.menu = MENUS.MAIN;
        } else if (lastInput === '2') {
          session.language = 'sw';
          response = buildMainMenu('sw');
          session.menu = MENUS.MAIN;
        } else {
          response = `END Invalid selection. Please try again.`;
          clearSession(sessionId, phoneNumber);
        }
      }
    }
    
    // Main menu - after language selection
    else if (textArray.length === 1 && session.menu === MENUS.MAIN) {
      const lang = session.language || 'en';
      const messages = {
        en: {
          noOrders: 'No previous orders found.',
          recentOrders: 'Recent Orders:',
          goodbye: 'Thank you for using Soko Connect!',
          invalid: 'Invalid selection. Please try again.'
        },
        sw: {
          noOrders: 'Hakuna maagizo ya awali.',
          recentOrders: 'Maagizo ya Hivi Karibuni:',
          goodbye: 'Asante kwa kutumia Soko Connect!',
          invalid: 'Chaguo batili. Jaribu tena.'
        }
      };
      const msg = messages[lang] || messages.en;
      
      switch (lastInput) {
        case '1': // Shop Products
          response = buildShopMenu(lang);
          session.menu = MENUS.SHOP;
          break;
          
        case '2': // View Cart
          const cart = MarketplaceService.getCart(phoneNumber);
          response = buildCartView(cart, lang);
          session.menu = MENUS.CART;
          break;
          
        case '3': // Wallet
          response = buildWalletMenu(lang);
          session.menu = MENUS.WALLET;
          break;
          
        case '4': // Order History
          const orders = MarketplaceService.getOrderHistory(phoneNumber, 3);
          if (orders.length === 0) {
            response = `END ${msg.noOrders}`;
          } else {
            response = `END ${msg.recentOrders}\n`;
            orders.forEach(order => {
              const totalFormatted = order.total.toLocaleString();
              response += `${order.orderNumber || order.id}: ${totalFormatted} TZS (${order.items.length} ${lang === 'sw' ? 'bidhaa' : 'items'})\n`;
            });
          }
          clearSession(sessionId, phoneNumber);
          break;
          
        case '5': // Call to Shop
          const voiceResult = await initiateVoiceCall(phoneNumber);
          response = `END ${voiceResult.message}`;
          clearSession(sessionId, phoneNumber);
          break;
          
        case '0': // Exit
          response = `END ${msg.goodbye}`;
          clearSession(sessionId, phoneNumber);
          break;
          
        default:
          response = `END ${msg.invalid}`;
          clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 2: Shop menu selections
    else if (textArray.length === 2 && textArray[0] === '1') {
      const lang = session.language || 'en';
      switch (lastInput) {
        case '1': // Browse All Products
          const products = await MarketplaceService.getProducts();
          response = buildProductList(products, 1, 5, lang);
          session.menu = MENUS.PRODUCT_LIST;
          session.data.products = products;
          session.data.page = 1;
          break;
          
        case '2': // Search Products
          response = `CON Enter product name to search:`;
          session.menu = 'search_input';
          break;
          
        case '3': // View Categories
          const categories = await MarketplaceService.getCategories();
          response = `CON Categories:\n`;
          categories.forEach((cat, index) => {
            response += `${index + 1}. ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n`;
          });
          response += `0. Back to Shop Menu`;
          session.menu = 'categories';
          session.data.categories = categories;
          break;
          
        case '4': // Back to Main Menu
          response = buildMainMenu(lang);
          session.menu = MENUS.MAIN;
          break;
          
        default:
          response = `END Invalid selection.`;
          clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 2: Wallet menu selections
    else if (textArray.length === 2 && textArray[0] === '3') {
      const lang = session.language || 'en';
      switch (lastInput) {
        case '1': // Check Balance
          const balance = PaymentService.getBalance(phoneNumber);
          response = `END Your balance: ${balance.balance.toLocaleString()} ${balance.currency}`;
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
              response += `${type} ${tx.amount.toLocaleString()} TZS ${type === 'Sent' ? 'to' : 'from'} ${other}\n`;
            });
          }
          clearSession(sessionId, phoneNumber);
          break;
          
        case '4': // Add Money (Demo)
          response = `CON Enter amount to add:`;
          session.menu = 'add_money';
          break;
          
        case '0': // Back to Main Menu
          response = buildMainMenu(lang);
          session.menu = MENUS.MAIN;
          break;
          
        default:
          response = `END Invalid selection.`;
          clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 2: Cart menu selections
    else if (textArray.length === 2 && textArray[0] === '2') {
      const lang = session.language || 'en';
      const cart = MarketplaceService.getCart(phoneNumber);
      const selection = parseInt(lastInput);
      
      // Handle empty cart - "Go Shopping" option
      if (cart.items.length === 0 && selection === 1) {
        // Go directly to product list
        const products = await MarketplaceService.getProducts();
        response = buildProductList(products, 1, 5, lang);
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
        const checkoutResult = await MarketplaceService.processCheckout(phoneNumber);
        response = `END ${checkoutResult.message}`;
        clearSession(sessionId, phoneNumber);
      }
      else if (selection === cart.items.length + 2) {
        // Clear cart
        MarketplaceService.clearCart(phoneNumber);
        response = `END Cart cleared successfully.`;
        clearSession(sessionId, phoneNumber);
      }
      else if (selection === 0) {
        // Back to main menu
        response = buildMainMenu(lang);
        session.menu = MENUS.MAIN;
      }
      else {
        response = `END Invalid selection.`;
        clearSession(sessionId, phoneNumber);
      }
    }
    
    // Handle product selection when in PRODUCT_LIST menu (session-based fallback)
    else if (session.menu === MENUS.PRODUCT_LIST) {
      const lang = session.language || 'en';
      const products = session.data.products || await MarketplaceService.getProducts();
      const page = session.data.page || 1;
      const itemsPerPage = 5;
      const maxItems = Math.min(itemsPerPage, products.length - (page - 1) * itemsPerPage);
      
      const selection = parseInt(lastInput);
      
      if (selection >= 1 && selection <= maxItems) {
        // Add product to cart
        const productIndex = (page - 1) * itemsPerPage + selection - 1;
        const product = products[productIndex];
        const result = await MarketplaceService.addToCart(phoneNumber, product.id, 1);
        
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
        response = buildProductList(products, page + 1, itemsPerPage, lang);
      }
      else if (selection === itemsPerPage + 2 && page > 1) {
        // Previous page
        session.data.page = page - 1;
        response = buildProductList(products, page - 1, itemsPerPage, lang);
      }
      else if (selection === 0) {
        // Back to shop menu
        response = buildShopMenu(lang);
        session.menu = MENUS.SHOP;
      }
      else {
        response = `END Invalid selection.`;
        clearSession(sessionId, phoneNumber);
      }
    }
    
    // Handle cart menu (session-based fallback for any level)
    else if (session.menu === MENUS.CART) {
      const lang = session.language || 'en';
      const cart = MarketplaceService.getCart(phoneNumber);
      const selection = parseInt(lastInput);
      
      if (cart.items.length === 0) {
        // Empty cart handling
        if (selection === 1) {
          // Go Shopping
          const products = await MarketplaceService.getProducts();
          response = buildProductList(products, 1, 5, lang);
          session.menu = MENUS.PRODUCT_LIST;
          session.data.products = products;
          session.data.page = 1;
        } else if (selection === 0) {
          // Back to main menu
          response = buildMainMenu(lang);
          session.menu = MENUS.MAIN;
        } else {
          response = `END Invalid selection.`;
          clearSession(sessionId, phoneNumber);
        }
      } else {
        // Cart with items
        if (selection >= 1 && selection <= cart.items.length) {
          response = `END Item removal not implemented in USSD. Use SMS: "clear"`;
          clearSession(sessionId, phoneNumber);
        }
        else if (selection === cart.items.length + 1) {
          // Checkout
          const checkoutResult = await MarketplaceService.processCheckout(phoneNumber);
          response = `END ${checkoutResult.message}`;
          clearSession(sessionId, phoneNumber);
        }
        else if (selection === cart.items.length + 2) {
          // Clear cart
          MarketplaceService.clearCart(phoneNumber);
          response = `END Cart cleared successfully.`;
          clearSession(sessionId, phoneNumber);
        }
        else if (selection === 0) {
          // Back to main menu
          response = buildMainMenu(lang);
          session.menu = MENUS.MAIN;
        }
        else {
          response = `END Invalid selection.`;
          clearSession(sessionId, phoneNumber);
        }
      }
    }
    
    // Level 3: Product list selections (path-based handling)
    else if (textArray.length === 3 && textArray[0] === '1' && textArray[1] === '1') {
      const lang = session.language || 'en';
      const products = session.data.products || await MarketplaceService.getProducts();
      const page = session.data.page || 1;
      const itemsPerPage = 5;
      const maxItems = Math.min(itemsPerPage, products.length - (page - 1) * itemsPerPage);
      
      const selection = parseInt(lastInput);
      
      if (selection >= 1 && selection <= maxItems) {
        // Add product to cart
        const productIndex = (page - 1) * itemsPerPage + selection - 1;
        const product = products[productIndex];
        const result = await MarketplaceService.addToCart(phoneNumber, product.id, 1);
        
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
        response = buildProductList(products, page + 1, itemsPerPage, lang);
      }
      else if (selection === itemsPerPage + 2 && page > 1) {
        // Previous page
        session.data.page = page - 1;
        response = buildProductList(products, page - 1, itemsPerPage, lang);
      }
      else if (selection === 0) {
        // Back to shop menu
        response = buildShopMenu(lang);
        session.menu = MENUS.SHOP;
      }
      else {
        response = `END Invalid selection.`;
        clearSession(sessionId, phoneNumber);
      }
    }
    
    // Level 4+: Continue shopping after adding to cart (any depth)
    else if (textArray.length >= 4 && session.menu === 'after_add_to_cart') {
      const lang = session.language || 'en';
      switch (lastInput) {
        case '1': // Continue Shopping
          const products = await MarketplaceService.getProducts();
          response = buildProductList(products, 1, 5, lang);
          session.menu = MENUS.PRODUCT_LIST;
          session.data.products = products;
          session.data.page = 1;
          break;
          
        case '2': // View Cart
          const cart = MarketplaceService.getCart(phoneNumber);
          response = buildCartView(cart, lang);
          session.menu = MENUS.CART;
          break;
          
        case '3': // Checkout
          const checkoutResult = await MarketplaceService.processCheckout(phoneNumber);
          response = `END ${checkoutResult.message}`;
          clearSession(sessionId, phoneNumber);
          break;
          
        case '0': // Main Menu
          response = buildMainMenu(lang);
          session.menu = MENUS.MAIN;
          break;
          
        default:
          response = `END Invalid selection.`;
          clearSession(sessionId, phoneNumber);
      }
    }
    
    // Handle special flows (send money, add money, search)
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
        response = `END Added ${amount.toLocaleString()} TZS. New balance: ${newBalance.balance.toLocaleString()} TZS`;
      }
      clearSession(sessionId, phoneNumber);
    }
    else if (session.menu === 'search_input') {
      const searchQuery = lastInput;
      const products = await MarketplaceService.searchProducts(searchQuery);
      
      if (products.length === 0) {
        response = `END No products found for "${searchQuery}". Try different keywords.`;
        clearSession(sessionId, phoneNumber);
      } else {
        const lang = session.language || 'en';
        response = buildProductList(products, 1, 5, lang);
        session.menu = MENUS.PRODUCT_LIST;
        session.data.products = products;
        session.data.page = 1;
      }
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

// Initiate voice call for shopping
async function initiateVoiceCall(phoneNumber) {
  try {
    const at = require('../config/at');
    const voice = at.VOICE;
    
    // Voice call options with language selection callback
    const host = process.env.HOST || 'localhost:3000';
    const callbackUrl = `https://${host}/voice/shop-lang`;
    
    const options = {
      to: phoneNumber,
      from: process.env.AT_VOICE_PHONE_NUMBER || '+254711000000', // Your voice number
      callbackUrl: callbackUrl
    };
    
    console.log(`[USSD] Initiating voice shopping call to ${phoneNumber}`);
    console.log(`[USSD] Voice callback URL: ${callbackUrl}`);
    
    // Make the voice call
    const response = await voice.call(options);
    
    console.log('[USSD] Voice call response:', response);
    
    return {
      success: true,
      message: `Voice shopping call initiated to ${phoneNumber}. You will receive a call shortly. Choose your language then follow voice prompts to shop.`
    };
    
  } catch (error) {
    console.error('[USSD] Voice call error:', error);
    return {
      success: false,
      message: 'Voice call service temporarily unavailable. Please use USSD shopping instead.'
    };
  }
}

module.exports = router;