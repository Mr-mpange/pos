const { GoogleGenerativeAI } = require('@google/generative-ai');
const PaymentService = require('./payments');
const MarketplaceService = require('./marketplace');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
let genAI;
let model;

// Simple conversation memory (in production, use Redis or database)
const conversationMemory = new Map();

function getModel() {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        maxOutputTokens: 200,
      }
    });
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

function updateConversationMemory(phoneNumber, userText, botResponse) {
  if (!conversationMemory.has(phoneNumber)) {
    conversationMemory.set(phoneNumber, []);
  }
  const history = conversationMemory.get(phoneNumber);
  history.push({ user: userText, bot: botResponse, timestamp: Date.now() });
  
  // Keep only last 5 exchanges to avoid memory bloat
  if (history.length > 5) {
    history.shift();
  }
}

function getConversationContext(phoneNumber) {
  const history = conversationMemory.get(phoneNumber) || [];
  if (history.length === 0) return '';
  
  let context = 'Recent conversation:\n';
  history.slice(-3).forEach(exchange => {
    context += `Customer: ${exchange.user}\nYou: ${exchange.bot}\n`;
  });
  return context;
}

// Add some personality variations
function getGreetingVariation() {
  const greetings = [
    'Hey there!',
    'Hi!',
    'Hello!',
    'Hey!',
    'Hi there!'
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

function getPositiveResponse() {
  const responses = [
    'Great!',
    'Perfect!',
    'Awesome!',
    'Nice!',
    'Excellent!'
  ];
  return responses[Math.floor(Math.random() * responses.length)];
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
async function findProduct(query) {
  // Try to find by ID first
  const product = await MarketplaceService.getProduct(query);
  if (product) return product;
  
  // Search by name
  const results = await MarketplaceService.searchProducts(query);
  return results.length > 0 ? results[0] : null;
}

async function generateReply(userText, phoneNumber) {
  try {
    const model = getModel();
    
    // First check if it's a POS command
    const posCommand = parsePOSCommand(userText);
    
    if (posCommand) {
      console.log(`[AI] POS command detected:`, posCommand);
      
      let baseResponse = '';
      
      switch (posCommand.type) {
        case 'browse':
          const products = await MarketplaceService.getProducts();
          const topProducts = products.slice(0, 5);
          baseResponse = `Here's what we have in stock today:\n`;
          topProducts.forEach(p => {
            baseResponse += `${p.name} - ${p.price.toLocaleString()} TZS/${p.unit} (${p.vendorName})\n`;
          });
          baseResponse += '\nJust tell me what you want to add to your cart!';
          break;
          
        case 'search':
          const searchResults = await MarketplaceService.searchProducts(posCommand.query);
          if (searchResults.length === 0) {
            baseResponse = `Sorry, I couldn't find "${posCommand.query}" in our marketplace. Would you like to see what else we have?`;
          } else {
            baseResponse = `Great! I found these for you:\n`;
            searchResults.slice(0, 3).forEach(p => {
              baseResponse += `${p.name} - ${p.price.toLocaleString()} TZS/${p.unit} (${p.stock} available, ${p.vendorName})\n`;
            });
            baseResponse += '\nWhich one would you like to add?';
          }
          break;
          
        case 'add':
          const product = await findProduct(posCommand.productQuery);
          if (!product) {
            baseResponse = `I couldn't find "${posCommand.productQuery}" in our marketplace. Let me show you what's available instead.`;
          } else {
            const addResult = await MarketplaceService.addToCart(phoneNumber, product.id, posCommand.quantity);
            baseResponse = addResult.message;
          }
          break;
          
        case 'cart':
          const cart = MarketplaceService.getCart(phoneNumber);
          if (cart.items.length === 0) {
            baseResponse = 'Your cart is empty right now. Would you like to browse our marketplace?';
          } else {
            baseResponse = 'Here\'s what you have so far:\n';
            cart.items.forEach(item => {
              baseResponse += `${item.quantity} ${item.unit}(s) ${item.name} - ${item.subtotal.toLocaleString()} TZS\n`;
            });
            baseResponse += `\nTotal: ${cart.total.toLocaleString()} TZS\nReady to checkout?`;
          }
          break;
          
        case 'checkout':
          const checkoutResult = await MarketplaceService.processCheckout(phoneNumber);
          baseResponse = checkoutResult.message;
          break;
          
        case 'clear':
          MarketplaceService.clearCart(phoneNumber);
          baseResponse = 'All cleared! Your cart is now empty.';
          break;
          
        case 'orders':
          const orders = MarketplaceService.getOrderHistory(phoneNumber, 3);
          if (orders.length === 0) {
            baseResponse = 'You haven\'t made any orders with us yet. Ready to start shopping?';
          } else {
            baseResponse = 'Here are your recent orders:\n';
            orders.forEach(order => {
              const totalFormatted = order.total.toLocaleString();
              baseResponse += `Order ${order.orderNumber || order.id}: ${totalFormatted} TZS (${order.items.length} items)\n`;
            });
          }
          break;
          
        default:
          baseResponse = 'I\'m not sure what you\'re looking for. Try asking me to show products, check your cart, or see your balance.';
      }
      
      // Make the response more human using AI
      const humanizePrompt = `You are Maya, a friendly store assistant. Make this response more conversational and warm while keeping all the important information. Keep it under 160 characters:

"${baseResponse}"

Make it sound like you're texting a friend who's shopping at your store. Be helpful and enthusiastic.`;
      
      try {
        const result = await model.generateContent(humanizePrompt);
        const humanResponse = result.response.text();
        const finalResponse = sanitizeReply(humanResponse);
        updateConversationMemory(phoneNumber, userText, finalResponse);
        return finalResponse;
      } catch (aiErr) {
        console.warn('[AI] Humanization failed, using base response:', aiErr.message);
        const finalResponse = sanitizeReply(baseResponse);
        updateConversationMemory(phoneNumber, userText, finalResponse);
        return finalResponse;
      }
    }
    
    // Check if it's a payment command
    const paymentCommand = parsePaymentCommand(userText);
    
    if (paymentCommand) {
      console.log(`[AI] Payment command detected:`, paymentCommand);
      
      let baseResponse = '';
      
      switch (paymentCommand.type) {
        case 'balance':
          const balance = PaymentService.getBalance(phoneNumber);
          baseResponse = `Your current balance is ${balance.balance} ${balance.currency}`;
          break;
          
        case 'send':
          const result = await PaymentService.processPayment(
            phoneNumber,
            paymentCommand.recipient,
            paymentCommand.amount,
            paymentCommand.description
          );
          baseResponse = result.message;
          break;
          
        case 'history':
          const transactions = PaymentService.getTransactions(phoneNumber, 3);
          if (transactions.length === 0) {
            baseResponse = 'You haven\'t made any transactions yet.';
          } else {
            baseResponse = 'Your recent transactions:\n';
            transactions.forEach(tx => {
              const type = tx.from === phoneNumber ? 'Sent' : 'Received';
              const other = tx.from === phoneNumber ? tx.to : tx.from;
              baseResponse += `${type} ${tx.amount} TZS ${type === 'Sent' ? 'to' : 'from'} ${other}\n`;
            });
          }
          break;
          
        case 'add':
          const newBalance = PaymentService.addMoney(phoneNumber, paymentCommand.amount);
          baseResponse = `Successfully added ${paymentCommand.amount} TZS. Your new balance is ${newBalance.balance} TZS`;
          break;
          
        default:
          baseResponse = 'I can help you check your balance, send money, or view transaction history. What would you like to do?';
      }
      
      // Make payment responses more human
      const humanizePrompt = `You are Maya, a helpful customer service rep. Make this payment response more friendly and reassuring while keeping all the important information:

"${baseResponse}"

Sound like you're personally helping them with their money. Be warm and trustworthy. Keep under 160 characters.`;
      
      try {
        const result = await model.generateContent(humanizePrompt);
        const humanResponse = result.response.text();
        const finalResponse = sanitizeReply(humanResponse);
        updateConversationMemory(phoneNumber, userText, finalResponse);
        return finalResponse;
      } catch (aiErr) {
        console.warn('[AI] Payment humanization failed, using base response:', aiErr.message);
        const finalResponse = sanitizeReply(baseResponse);
        updateConversationMemory(phoneNumber, userText, finalResponse);
        return finalResponse;
      }
    }
    
    // For general conversation, use AI to understand intent and respond naturally
    const conversationContext = getConversationContext(phoneNumber);
    const conversationPrompt = `You are Maya, a friendly SMS assistant for Soko Connect marketplace and mobile wallet service. ${conversationContext ? conversationContext + '\n' : ''}A customer just texted: "${userText}"

Respond naturally and helpfully like you're texting a friend. You can:
- Help them shop from local vendors (browse products, search items, add to cart, checkout)
- Manage their wallet (check balance, send money, view history)
- Have casual conversation while guiding them to services

Keep your response under 160 characters and sound like a real person texting back. Be warm, helpful, and conversational. Use emojis sparingly if appropriate.

Available services:
- Shopping: "shop" to browse marketplace, "search [item]" to find products from vendors
- Wallet: "balance" to check money, "send [amount] to [number]" for transfers
- Cart: "cart" to view, "checkout" to buy from vendors`;

    try {
      const result = await model.generateContent(conversationPrompt);
      const response = result.response.text();
      const finalResponse = sanitizeReply(response);
      
      // Update conversation memory
      updateConversationMemory(phoneNumber, userText, finalResponse);
      
      return finalResponse;
    } catch (aiErr) {
      console.warn('[AI] Conversation AI failed:', aiErr.message);
      const fallbackResponse = 'Hi! I can help you shop or manage your wallet. Try "shop" to browse products or "balance" to check your money.';
      updateConversationMemory(phoneNumber, userText, fallbackResponse);
      return sanitizeReply(fallbackResponse);
    }
    
  } catch (err) {
    console.warn('[AI] generateReply failed:', err.message);
    const fallbackResponse = 'Hey! Something went wrong on my end. I\'m here to help with shopping and payments though. What can I do for you?';
    updateConversationMemory(phoneNumber, userText, fallbackResponse);
    return fallbackResponse;
  }
}

module.exports = { generateReply };
