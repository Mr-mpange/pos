const { GoogleGenerativeAI } = require('@google/generative-ai');
const PaymentService = require('./payments');
const MarketplaceService = require('./marketplace');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
let genAI;
let model;

// Simple conversation memory (in production, use Redis or database)
const conversationMemory = new Map();

// User session tracking for guided flow
const userSessions = new Map();

// Session states for guided flow
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

function updateUserSession(phoneNumber, updates) {
  const session = getUserSession(phoneNumber);
  Object.assign(session, updates, { lastActivity: Date.now() });
  userSessions.set(phoneNumber, session);
}

function getNextStepGuidance(phoneNumber, currentAction = null) {
  const session = getUserSession(phoneNumber);
  const cart = MarketplaceService.getCart(phoneNumber);
  
  // Update session state based on current situation
  if (cart.items.length === 0 && session.state !== SESSION_STATES.WELCOME) {
    session.state = SESSION_STATES.BROWSING;
  } else if (cart.items.length > 0 && !session.hasViewedCart) {
    session.state = SESSION_STATES.ADDING_ITEMS;
  } else if (cart.items.length > 0 && session.hasViewedCart) {
    session.state = SESSION_STATES.READY_TO_CHECKOUT;
  }
  
  let guidance = '';
  
  switch (session.state) {
    case SESSION_STATES.WELCOME:
      guidance = '\n\n💡 Next: Type "shop" to browse products or "search [item]" to find something specific!';
      break;
      
    case SESSION_STATES.BROWSING:
      guidance = '\n\n💡 Next: Found something you like? Type "add [item name]" to add it to your cart!';
      break;
      
    case SESSION_STATES.ADDING_ITEMS:
      if (currentAction === 'add') {
        guidance = `\n\n💡 Great! You have ${cart.items.length} item(s) in your cart. Type "cart" to review or keep shopping!`;
      } else {
        guidance = '\n\n💡 Next: Type "cart" to review your items or add more products!';
      }
      break;
      
    case SESSION_STATES.READY_TO_CHECKOUT:
      if (cart.total > 0) {
        guidance = '\n\n💡 Ready to buy? Type "checkout" to complete your purchase!';
      }
      break;
      
    case SESSION_STATES.PAYMENT_PENDING:
      guidance = '\n\n💡 Check your phone for the payment prompt and enter your PIN to complete the purchase!';
      break;
      
    default:
      guidance = '';
  }
  
  return guidance;
}

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

// Check if user input is off-topic and needs redirection
function isOffTopicMessage(text) {
  const lowerText = text.toLowerCase().trim();
  
  // First check if message contains shopping/payment intent even with greetings
  const hasShoppingIntent = /shop|buy|kununua|nataka|balance|cart|checkout|search|add|remove|send|pay|history|orders|help|nunua|ununue/.test(lowerText);
  if (hasShoppingIntent) {
    return false; // Don't redirect if there's clear service intent
  }
  
  // Common off-topic patterns (only match if they're standalone)
  const offTopicPatterns = [
    /^(hi|hello|hey|mambo|salama|hujambo)$/,  // Removed 'habari' from here since it can be part of longer messages
    /^(how are you|habari yako|u hali gani)$/,
    /^(good morning|good afternoon|good evening)$/,
    /^(thanks|thank you|asante)$/,
    /^(bye|goodbye|kwaheri)$/,
    /^habari$/, // Only match standalone 'habari'
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

// Detect user's language from their message
function detectLanguage(text) {
  const lowerText = text.toLowerCase().trim();
  
  // Swahili indicators
  const swahiliPatterns = [
    /\b(habari|mambo|hujambo|salama|vipi|niko|poa|safi|asante|kwaheri|nataka|kununua|nunua|ununue|bei|pesa|simu|duka|bidhaa|chakula|maji|maziwa|mkate|mchele|nyama|mboga|matunda|hali|ya|hewa|leo|kesho|jana|wiki|mwezi|mwaka|shule|kazi|nyumbani|familia|rafiki|ndugu|mama|baba|mtoto|mzee|kijana|mwanamke|mwanaume|gari|pikipiki|basi|treni|ndege|bahari|mlima|mto|ziwa|jiji|kijiji|hospitali|duka|sokoni|kanisani|msikitini|shuleni|kazini|nyumbani)\b/,
    /\b(na|wa|ya|za|la|ra|ma|ba|pa|ku|mu|ki|vi|u|i|a|e|o)\b/,
    /\b(hii|hiyo|ile|haya|hayo|yale|hawa|hao|wale)\b/,
    /\b(mimi|wewe|yeye|sisi|nyinyi|wao)\b/,
    /\b(ndiyo|hapana|ndio|siyo|naam|la)\b/
  ];
  
  // English indicators (common words that are distinctly English)
  const englishPatterns = [
    /\b(the|and|or|but|with|from|they|have|this|that|will|would|could|should|there|where|when|what|how|why|who|which|some|many|much|very|good|bad|big|small|new|old|first|last|long|short|high|low|right|left|up|down|in|on|at|by|for|of|to|from|about|over|under|through|during|before|after|since|until|while|because|although|however|therefore|moreover|furthermore|nevertheless|meanwhile|otherwise|instead|besides|except|including|regarding|concerning|according|depending|considering|assuming|provided|unless|whether|either|neither|both|all|any|each|every|no|none|nothing|something|anything|everything|someone|anyone|everyone|nobody|somebody|anybody|everybody)\b/,
    /\b(hello|hi|hey|good|morning|afternoon|evening|night|thanks|thank|you|please|sorry|excuse|me|yes|no|okay|ok|sure|maybe|perhaps|probably|definitely|certainly|absolutely|exactly|really|actually|basically|generally|usually|always|never|sometimes|often|rarely|seldom|frequently|occasionally|immediately|quickly|slowly|carefully|easily|hardly|nearly|almost|quite|rather|pretty|fairly|extremely|incredibly|amazingly|surprisingly|unfortunately|fortunately|obviously|clearly|apparently|evidently|presumably|supposedly|allegedly|reportedly|seemingly|apparently)\b/
  ];
  
  const hasSwahili = swahiliPatterns.some(pattern => pattern.test(lowerText));
  const hasEnglish = englishPatterns.some(pattern => pattern.test(lowerText));
  
  // If both or neither detected, default to English for international compatibility
  if (hasSwahili && !hasEnglish) {
    return 'sw'; // Swahili
  } else {
    return 'en'; // English (default)
  }
}

// Get service redirect response in appropriate language
function getServiceRedirectResponse(phoneNumber, language = 'en') {
  const cart = MarketplaceService.getCart(phoneNumber);
  const session = getUserSession(phoneNumber);
  
  const responses = {
    en: [
      'Type "shop" or "balance"',
      'Try "shop" or "balance"',
      'Use "shop" or "balance"',
      '"shop" or "balance"?'
    ],
    sw: [
      'Andika "shop" au "balance"',
      'Jaribu "shop" au "balance"',
      'Tumia "shop" au "balance"',
      '"shop" au "balance"?'
    ]
  };
  
  const cartResponses = {
    en: 'Type "cart" or "checkout"',
    sw: 'Andika "cart" au "checkout"'
  };
  
  // Choose response based on user state
  if (cart.items.length > 0) {
    return cartResponses[language] || cartResponses.en;
  } else {
    const langResponses = responses[language] || responses.en;
    return langResponses[0]; // Use first response for consistency
  }
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
  
  // Remove from cart by index: "remove 1", "delete 2"
  const removeIndexMatch = lowerText.match(/^(remove|delete)\s+(\d+)$/);
  if (removeIndexMatch) {
    return { type: 'removeByIndex', itemIndex: parseInt(removeIndexMatch[2]) };
  }
  
  // Remove from cart by name: "remove bread", "delete cola"
  const removeNameMatch = lowerText.match(/^(remove|delete)\s+(.+)$/);
  if (removeNameMatch) {
    return { type: 'removeByName', productQuery: removeNameMatch[2] };
  }
  
  // View cart: "cart", "basket", "my cart"
  if (lowerText.match(/^(cart|basket|my cart)$/)) {
    return { type: 'cart' };
  }
  
  // Checkout: "checkout", "pay", "buy now"
  if (lowerText.match(/^(checkout|buy now|purchase)$/)) {
    return { type: 'checkout' };
  }
  
  // Pay (separate from buy now to avoid conflict with add command)
  if (lowerText === 'pay') {
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
  
  // Help: "help", "commands"
  if (lowerText.match(/^(help|commands|what can you do)$/)) {
    return { type: 'help' };
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
    
    // First check if it's off-topic and redirect immediately
    if (isOffTopicMessage(userText)) {
      console.log(`[AI] Off-topic message detected: "${userText}"`);
      const detectedLanguage = detectLanguage(userText);
      console.log(`[AI] Detected language: ${detectedLanguage}`);
      const redirectResponse = getServiceRedirectResponse(phoneNumber, detectedLanguage);
      updateConversationMemory(phoneNumber, userText, redirectResponse);
      return redirectResponse;
    }
    
    // First check if it's a POS command
    const posCommand = parsePOSCommand(userText);
    
    if (posCommand) {
      console.log(`[AI] POS command detected:`, posCommand);
      
      let baseResponse = '';
      const session = getUserSession(phoneNumber);
      
      switch (posCommand.type) {
        case 'browse':
          const products = await MarketplaceService.getProducts();
          const topProducts = products.slice(0, 5);
          baseResponse = `Here's what we have in stock today:\n`;
          topProducts.forEach(p => {
            baseResponse += `${p.name} - ${p.price.toLocaleString()} TZS/${p.unit} (${p.vendorName})\n`;
          });
          baseResponse += '\nJust tell me what you want to add to your cart!';
          updateUserSession(phoneNumber, { state: SESSION_STATES.BROWSING });
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
          updateUserSession(phoneNumber, { state: SESSION_STATES.BROWSING });
          break;
          
        case 'add':
          const product = await findProduct(posCommand.productQuery);
          if (!product) {
            baseResponse = `I couldn't find "${posCommand.productQuery}" in our marketplace. Let me show you what's available instead.`;
          } else {
            const addResult = await MarketplaceService.addToCart(phoneNumber, product.id, posCommand.quantity);
            baseResponse = addResult.message;
            if (addResult.success) {
              updateUserSession(phoneNumber, { 
                state: SESSION_STATES.ADDING_ITEMS,
                cartItemsAdded: session.cartItemsAdded + 1
              });
            }
          }
          break;
          
        case 'removeByIndex':
          const removeResult = MarketplaceService.removeFromCartByIndex(phoneNumber, posCommand.itemIndex);
          baseResponse = removeResult.message;
          if (removeResult.success) {
            const cart = MarketplaceService.getCart(phoneNumber);
            if (cart.items.length === 0) {
              updateUserSession(phoneNumber, { state: SESSION_STATES.BROWSING });
            }
          }
          break;
          
        case 'removeByName':
          const productToRemove = await findProduct(posCommand.productQuery);
          if (!productToRemove) {
            baseResponse = `I couldn't find "${posCommand.productQuery}" in your cart. Type "cart" to see what you have.`;
          } else {
            const removeNameResult = MarketplaceService.removeFromCart(phoneNumber, productToRemove.id);
            baseResponse = removeNameResult.message;
            if (removeNameResult.success) {
              const cart = MarketplaceService.getCart(phoneNumber);
              if (cart.items.length === 0) {
                updateUserSession(phoneNumber, { state: SESSION_STATES.BROWSING });
              }
            }
          }
          break;
          
        case 'cart':
          const cartResult = MarketplaceService.getFormattedCart(phoneNumber);
          baseResponse = cartResult.message;
          updateUserSession(phoneNumber, { 
            hasViewedCart: true,
            state: cartResult.cart.items.length > 0 ? SESSION_STATES.READY_TO_CHECKOUT : SESSION_STATES.BROWSING
          });
          break;
          
        case 'checkout':
          const cart = MarketplaceService.getCart(phoneNumber);
          if (cart.items.length === 0) {
            baseResponse = 'Your cart is empty! Type "shop" to browse products first.';
            updateUserSession(phoneNumber, { state: SESSION_STATES.BROWSING });
          } else {
            const checkoutResult = await MarketplaceService.processCheckout(phoneNumber);
            baseResponse = checkoutResult.message;
            if (checkoutResult.success) {
              updateUserSession(phoneNumber, { 
                state: SESSION_STATES.PAYMENT_PENDING,
                checkoutAttempts: session.checkoutAttempts + 1
              });
            }
          }
          break;
          
        case 'clear':
          const clearResult = MarketplaceService.clearCart(phoneNumber);
          baseResponse = clearResult.message;
          updateUserSession(phoneNumber, { 
            state: SESSION_STATES.BROWSING,
            hasViewedCart: false,
            cartItemsAdded: 0
          });
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
          
        case 'help':
          baseResponse = `I can help you shop and manage payments! 🛒💰

Shopping commands:
• "shop" - Browse products
• "search [item]" - Find specific items
• "add [item]" - Add to cart
• "cart" - View your cart
• "remove [number]" - Remove item by number
• "checkout" - Complete purchase
• "clear" - Empty cart

Payment commands:
• "balance" - Check your money
• "send [amount] to [number]" - Transfer money
• "history" - View transactions

Just text me naturally and I'll help guide you through everything!`;
          break;
          
        default:
          baseResponse = 'I\'m not sure what you\'re looking for. Try asking me to show products, check your cart, or see your balance.';
      }
      
      // Add guided flow suggestions
      const guidance = getNextStepGuidance(phoneNumber, posCommand.type);
      baseResponse += guidance;
      
      // Make the response more human using AI
      const humanizePrompt = `You are Maya, a business-focused assistant for Soko Connect marketplace. Make this response more conversational while keeping it strictly about shopping services. Keep it under 160 characters and always guide users to take action:

"${baseResponse}"

Make it sound professional but friendly, like a store assistant helping customers. Focus ONLY on shopping and payments. Always end with a clear next step suggestion.`;
      
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
      const humanizePrompt = `You are Maya, a professional customer service rep for Soko Connect wallet services. Make this payment response more business-focused while keeping all the important information:

"${baseResponse}"

Sound professional and trustworthy about money matters. Keep under 160 characters and always suggest next steps for shopping or payments.`;
      
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
    const session = getUserSession(phoneNumber);
    const cart = MarketplaceService.getCart(phoneNumber);
    const detectedLanguage = detectLanguage(userText);
    
    // Check if this is a new user or someone who needs guidance
    const isNewUser = session.state === SESSION_STATES.WELCOME && conversationContext === '';
    const needsGuidance = cart.items.length === 0 && session.cartItemsAdded === 0;
    
    const languageInstructions = {
      en: 'Respond in English only.',
      sw: 'Respond in Swahili only. Use proper Swahili grammar and vocabulary.'
    };
    
    let conversationPrompt = `You are Maya, a focused SMS assistant ONLY for Soko Connect marketplace and mobile wallet service. You MUST stay strictly on-topic about shopping and payments.

CRITICAL RULES:
- NEVER engage in general conversation, greetings without purpose, or off-topic chat
- ALWAYS redirect users to shopping or payment services
- If someone says "hi", "hello", "habari", etc., immediately guide them to shop or check balance
- Do not respond to questions about weather, health, personal matters, or anything unrelated to your services
- Keep responses under 160 characters and always end with a service suggestion
- ${languageInstructions[detectedLanguage] || languageInstructions.en}

${conversationContext ? conversationContext + '\n' : ''}Customer just texted: "${userText}"
Detected language: ${detectedLanguage}

${isNewUser ? 'This is a new customer. Welcome them briefly and immediately guide them to shop or check wallet.' : ''}

${needsGuidance ? 'This customer needs to start shopping. Direct them to browse products or search for items.' : ''}

Current customer status:
- Cart items: ${cart.items.length}
- Cart total: ${cart.total} TZS
- Session state: ${session.state}

Your ONLY services:
- Shopping: "shop" to browse marketplace, "search [item]" to find products
- Cart: "cart" to view, "remove [number]" to remove items, "checkout" to buy
- Wallet: "balance" to check money, "send [amount] to [number]" for transfers
- Help: "help" for commands

Response must:
1. Be business-focused and service-oriented
2. Guide user to take action (shop, check balance, etc.)
3. Never engage in casual conversation
4. Always suggest next steps for shopping or payments
5. Be under 160 characters
6. Match the user's language (${detectedLanguage === 'sw' ? 'Swahili' : 'English'})

Example good responses in ${detectedLanguage === 'sw' ? 'Swahili' : 'English'}:
${detectedLanguage === 'sw' ? 
`- "Karibu! Andika 'shop' kuona bidhaa au 'balance' kuangalia pesa."
- "Natumikia ununuzi na malipo. Jaribu 'shop' au 'balance'."` :
`- "Hi! Ready to shop? Type 'shop' to browse products or 'balance' to check your wallet."
- "I'm here for shopping and payments. Try 'shop' to browse or 'balance' to check money."`}`;

    try {
      const result = await model.generateContent(conversationPrompt);
      const response = result.response.text();
      
      // Add guided flow suggestions for general conversation
      let finalResponse = response;
      if (needsGuidance || isNewUser) {
        const guidance = getNextStepGuidance(phoneNumber);
        if (guidance && !finalResponse.includes('💡')) {
          finalResponse += guidance;
        }
      }
      
      const sanitizedResponse = sanitizeReply(finalResponse);
      
      // Update conversation memory
      updateConversationMemory(phoneNumber, userText, sanitizedResponse);
      
      return sanitizedResponse;
    } catch (aiErr) {
      console.warn('[AI] Conversation AI failed:', aiErr.message);
      const fallbackResponse = isNewUser 
        ? (detectedLanguage === 'sw' ? 'Karibu! Andika "shop" au "balance"' : 'Welcome! Type "shop" or "balance"')
        : (detectedLanguage === 'sw' ? 'Andika "shop" au "balance"' : 'Type "shop" or "balance"');
      updateConversationMemory(phoneNumber, userText, fallbackResponse);
      return fallbackResponse;
    }
    
  } catch (err) {
    console.warn('[AI] generateReply failed:', err.message);
    const detectedLanguage = detectLanguage(userText);
    const fallbackResponse = detectedLanguage === 'sw' ? 'Andika "shop" au "balance"' : 'Type "shop" or "balance"';
    updateConversationMemory(phoneNumber, userText, fallbackResponse);
    return fallbackResponse;
  }
}

module.exports = { 
  generateReply,
  updateUserSession,
  getUserSession,
  SESSION_STATES
};
