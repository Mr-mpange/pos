const { GoogleGenerativeAI } = require('@google/generative-ai');
const PaymentService = require('./payments');
const POSService = require('./pos');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
let genAI;
let model;

function getModel() {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: MODEL_NAME });
    console.log(`[AI] Initialized Gemini model: ${MODEL_NAME}`);
  }
  return model;
}

function sanitizeReply(text, maxLen = 480) {
  if (!text) return 'Sorry, I could not generate a reply.';
  // SMS-friendly trimming
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? clean.slice(0, maxLen - 3) + '...' : clean;
}

// Parse POS commands from user text
function parsePOSCommand(text) {
  const lowerText = text.toLowerCase().trim();
  
  // Shop/Browse: "shop", "browse", "products", "menu"
  if (lowerText.match(/^(shop|browse|products|menu|store)$/)) {
    return { type: 'browse' };
  }
  
  // Search products: "search cola", "find bread"
  const searchMatch = lowerText.match(/^(search|find)\s+(.+)$/);
  if (searchMatch) {
    return { type: 'search', query: searchMatch[2] };
  }
  
  // Add to cart: "add 001", "add 2 bread", "buy 3 cola"
  const addMatch = lowerText.match(/^(add|buy)\s+(\d+\s+)?(.+)$/);
  if (addMatch) {
    const quantity = addMatch[2] ? parseInt(addMatch[2].trim()) : 1;
    const productQuery = addMatch[3];
    return { type: 'add', quantity, productQuery };
  }
  
  // View cart: "cart", "basket", "my cart"
  if (lowerText.match(/^(cart|basket|my cart)$/)) {
    return { type: 'cart' };
  }
  
  // Checkout: "checkout", "pay", "buy now"
  if (lowerText.match(/^(checkout|pay|buy now|purchase)$/)) {
    return { type: 'checkout' };
  }
  
  // Clear cart: "clear cart", "empty cart"
  if (lowerText.match(/^(clear cart|empty cart|clear)$/)) {
    return { type: 'clear' };
  }
  
  // Order history: "orders", "my orders", "history"
  if (lowerText.match(/^(orders|my orders|order history)$/)) {
    return { type: 'orders' };
  }
  
  return null;
}

// Parse payment commands from user text
function parsePaymentCommand(text) {
  const lowerText = text.toLowerCase().trim();
  
  // Check balance: "balance", "bal", "check balance"
  if (lowerText.match(/^(balance|bal|check balance)$/)) {
    return { type: 'balance' };
  }
  
  // Send money: "send 1000 to +255123456789", "pay 500 +255123456789"
  const sendMatch = lowerText.match(/^(send|pay|transfer)\s+(\d+)\s+(to\s+)?(\+?\d{10,15})(.*)$/);
  if (sendMatch) {
    return {
      type: 'send',
      amount: parseInt(sendMatch[2]),
      recipient: sendMatch[4].startsWith('+') ? sendMatch[4] : '+' + sendMatch[4],
      description: sendMatch[5]?.trim() || ''
    };
  }
  
  // Transaction history: "history", "transactions"
  if (lowerText.match(/^(history|transactions|statement)$/)) {
    return { type: 'history' };
  }
  
  // Add money (demo): "add 1000"
  const addMatch = lowerText.match(/^add\s+(\d+)$/);
  if (addMatch) {
    return {
      type: 'add',
      amount: parseInt(addMatch[1])
    };
  }
  
  return null;
}

// Find product by name or ID
function findProduct(query) {
  // Try to find by ID first
  const product = POSService.getProduct(query);
  if (product) return product;
  
  // Search by name
  const results = POSService.searchProducts(query);
  return results.length > 0 ? results[0] : null;
}

async function generateReply(userText, phoneNumber) {
  try {
    // First check if it's a POS command
    const posCommand = parsePOSCommand(userText);
    
    if (posCommand) {
      console.log(`[AI] POS command detected:`, posCommand);
      
      switch (posCommand.type) {
        case 'browse':
          const products = POSService.getProducts().slice(0, 5); // Show first 5
          let productList = 'Available Products:\n';
          products.forEach(p => {
            productList += `${p.id}: ${p.name} - ${p.price} TZS\n`;
          });
          productList += '\nSay "add [ID]" to add to cart or "search [name]" to find items';
          return sanitizeReply(productList);
          
        case 'search':
          const searchResults = POSService.searchProducts(posCommand.query);
          if (searchResults.length === 0) {
            return `No products found for "${posCommand.query}". Try "shop" to see all products.`;
          }
          let searchList = `Found ${searchResults.length} products:\n`;
          searchResults.slice(0, 3).forEach(p => {
            searchList += `${p.id}: ${p.name} - ${p.price} TZS (${p.stock} left)\n`;
          });
          searchList += '\nSay "add [ID]" to add to cart';
          return sanitizeReply(searchList);
          
        case 'add':
          const product = findProduct(posCommand.productQuery);
          if (!product) {
            return `Product "${posCommand.productQuery}" not found. Say "shop" to see available products.`;
          }
          const addResult = POSService.addToCart(phoneNumber, product.id, posCommand.quantity);
          return addResult.message;
          
        case 'cart':
          const cart = POSService.getCart(phoneNumber);
          if (cart.items.length === 0) {
            return 'Your cart is empty. Say "shop" to browse products.';
          }
          let cartText = 'Your Cart:\n';
          cart.items.forEach(item => {
            cartText += `${item.quantity}x ${item.name} - ${item.subtotal} TZS\n`;
          });
          cartText += `\nTotal: ${cart.total} TZS\nSay "checkout" to complete purchase`;
          return sanitizeReply(cartText);
          
        case 'checkout':
          const checkoutResult = await POSService.processCheckout(phoneNumber);
          return checkoutResult.message;
          
        case 'clear':
          POSService.clearCart(phoneNumber);
          return 'Cart cleared successfully.';
          
        case 'orders':
          const orders = POSService.getOrderHistory(phoneNumber, 3);
          if (orders.length === 0) {
            return 'No previous orders found.';
          }
          let orderText = 'Recent Orders:\n';
          orders.forEach(order => {
            orderText += `${order.id}: ${order.total} TZS (${order.items.length} items)\n`;
          });
          return sanitizeReply(orderText);
          
        default:
          return 'POS command not recognized. Try: shop, cart, checkout, balance';
      }
    }
    
    // Check if it's a payment command
    const paymentCommand = parsePaymentCommand(userText);
    
    if (paymentCommand) {
      console.log(`[AI] Payment command detected:`, paymentCommand);
      
      switch (paymentCommand.type) {
        case 'balance':
          const balance = PaymentService.getBalance(phoneNumber);
          return `Your balance: ${balance.balance} ${balance.currency}`;
          
        case 'send':
          const result = await PaymentService.processPayment(
            phoneNumber,
            paymentCommand.recipient,
            paymentCommand.amount,
            paymentCommand.description
          );
          return result.message;
          
        case 'history':
          const transactions = PaymentService.getTransactions(phoneNumber, 3);
          if (transactions.length === 0) {
            return 'No recent transactions found.';
          }
          let historyText = 'Recent transactions:\n';
          transactions.forEach(tx => {
            const type = tx.from === phoneNumber ? 'Sent' : 'Received';
            const other = tx.from === phoneNumber ? tx.to : tx.from;
            historyText += `${type} ${tx.amount} TZS ${type === 'Sent' ? 'to' : 'from'} ${other}\n`;
          });
          return sanitizeReply(historyText);
          
        case 'add':
          const newBalance = PaymentService.addMoney(phoneNumber, paymentCommand.amount);
          return `Added ${paymentCommand.amount} TZS. New balance: ${newBalance.balance} TZS`;
          
        default:
          return 'Payment command not recognized. Try: balance, send 1000 to +255123456789, history';
      }
    }
    
    // If not a POS or payment command, return help message
    return `Welcome to POS Store! Available commands:
SHOP: shop, search [item], add [item], cart, checkout, clear, orders
WALLET: balance, send [amount] to [number], history, add [amount]

Example: "shop" to browse products`;
    
  } catch (err) {
    console.warn('[AI] generateReply failed:', err.message);
    return 'POS Store temporarily unavailable. Try: shop, balance, cart';
  }
}

module.exports = { generateReply };
