const PaymentService = require('./payments');

// Mock product database - replace with real database
const products = new Map([
  ['001', { id: '001', name: 'Coca Cola', price: 1500, stock: 50, category: 'drinks' }],
  ['002', { id: '002', name: 'Bread', price: 2000, stock: 30, category: 'food' }],
  ['003', { id: '003', name: 'Milk 1L', price: 3000, stock: 20, category: 'dairy' }],
  ['004', { id: '004', name: 'Rice 2kg', price: 8000, stock: 15, category: 'food' }],
  ['005', { id: '005', name: 'Cooking Oil', price: 5500, stock: 25, category: 'cooking' }],
  ['006', { id: '006', name: 'Sugar 1kg', price: 2500, stock: 40, category: 'cooking' }],
  ['007', { id: '007', name: 'Tea Bags', price: 1800, stock: 35, category: 'drinks' }],
  ['008', { id: '008', name: 'Soap', price: 1200, stock: 60, category: 'hygiene' }]
]);

// Shopping carts for each user
const userCarts = new Map();
const orderHistory = new Map();

class POSService {
  
  // Get all products or by category
  static getProducts(category = null) {
    const allProducts = Array.from(products.values());
    if (category) {
      return allProducts.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    return allProducts;
  }

  // Search products by name
  static searchProducts(query) {
    const searchTerm = query.toLowerCase();
    return Array.from(products.values()).filter(p => 
      p.name.toLowerCase().includes(searchTerm) || 
      p.category.toLowerCase().includes(searchTerm)
    );
  }

  // Get product by ID
  static getProduct(productId) {
    return products.get(productId);
  }

  // Get user's cart
  static getCart(phoneNumber) {
    return userCarts.get(phoneNumber) || { items: [], total: 0 };
  }

  // Add item to cart
  static addToCart(phoneNumber, productId, quantity = 1) {
    const product = products.get(productId);
    if (!product) {
      return { success: false, message: 'Product not found' };
    }

    if (product.stock < quantity) {
      return { success: false, message: `Only ${product.stock} ${product.name} available` };
    }

    const cart = this.getCart(phoneNumber);
    const existingItem = cart.items.find(item => item.productId === productId);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (product.stock < newQuantity) {
        return { success: false, message: `Only ${product.stock} ${product.name} available` };
      }
      existingItem.quantity = newQuantity;
      existingItem.subtotal = existingItem.quantity * product.price;
    } else {
      cart.items.push({
        productId,
        name: product.name,
        price: product.price,
        quantity,
        subtotal: quantity * product.price
      });
    }

    cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    userCarts.set(phoneNumber, cart);
    
    console.log(`[POS] Cart after adding ${product.name}:`, JSON.stringify(cart, null, 2));

    return {
      success: true,
      message: `Added ${quantity}x ${product.name} to cart. Cart total: ${cart.total} TZS`,
      cart
    };
  }

  // Remove item from cart
  static removeFromCart(phoneNumber, productId) {
    const cart = this.getCart(phoneNumber);
    cart.items = cart.items.filter(item => item.productId !== productId);
    cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    userCarts.set(phoneNumber, cart);

    return {
      success: true,
      message: 'Item removed from cart',
      cart
    };
  }

  // Clear cart
  static clearCart(phoneNumber) {
    userCarts.delete(phoneNumber);
    return { success: true, message: 'Cart cleared' };
  }

  // Process checkout with PUSH payment
  static async processCheckout(phoneNumber) {
    const cart = this.getCart(phoneNumber);
    
    if (cart.items.length === 0) {
      return { success: false, message: 'Cart is empty' };
    }

    // Check stock availability
    for (const item of cart.items) {
      const product = products.get(item.productId);
      if (product.stock < item.quantity) {
        return {
          success: false,
          message: `${product.name} out of stock. Only ${product.stock} available`
        };
      }
    }

    try {
      // Generate order ID first
      const orderId = `ORD${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
      
      // Initiate PUSH payment request
      const pushResult = await this.initiatePushPayment(phoneNumber, cart.total, orderId);
      
      if (!pushResult.success) {
        return pushResult;
      }

      // Store pending order
      const pendingOrder = {
        id: orderId,
        phoneNumber,
        items: [...cart.items],
        total: cart.total,
        timestamp: new Date(),
        status: 'pending_payment',
        pushRequestId: pushResult.requestId
      };
      
      // Store in pending orders (in production, use database)
      if (!this.pendingOrders) {
        this.pendingOrders = new Map();
      }
      this.pendingOrders.set(orderId, pendingOrder);

      console.log(`[POS] PUSH payment initiated for order ${orderId}`);
      
      return {
        success: true,
        message: `Payment request sent to ${phoneNumber}. Please check your phone and enter PIN to confirm payment of ${cart.total} TZS`,
        orderId,
        status: 'pending_payment'
      };

    } catch (error) {
      console.error('[POS] Checkout error:', error);
      return {
        success: false,
        message: 'Checkout failed. Please try again.'
      };
    }
  }

  // Simulate PUSH payment initiation
  static async initiatePushPayment(phoneNumber, amount, orderId) {
    try {
      // In real implementation, this would call mobile money API (M-Pesa, Tigo Pesa, etc.)
      // For demo, we simulate the PUSH request
      
      const requestId = `PUSH${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
      
      console.log(`[POS] Initiating PUSH payment: ${amount} TZS to ${phoneNumber} for order ${orderId}`);
      
      // Simulate delay and auto-confirm payment after 3 seconds
      setTimeout(async () => {
        await this.confirmPayment(orderId, requestId, true);
      }, 3000);
      
      return {
        success: true,
        requestId,
        message: 'PUSH payment request sent'
      };
      
    } catch (error) {
      console.error('[POS] PUSH payment error:', error);
      return {
        success: false,
        message: 'Failed to initiate payment'
      };
    }
  }

  // Confirm payment and send SMS
  static async confirmPayment(orderId, requestId, isConfirmed) {
    try {
      if (!this.pendingOrders) {
        console.error('[POS] No pending orders found');
        return;
      }

      const pendingOrder = this.pendingOrders.get(orderId);
      if (!pendingOrder) {
        console.error(`[POS] Pending order ${orderId} not found`);
        return;
      }

      if (isConfirmed) {
        // Process successful payment
        const phoneNumber = pendingOrder.phoneNumber;
        
        // Deduct money from user balance
        const deductResult = PaymentService.deductMoney(phoneNumber, pendingOrder.total);
        if (!deductResult.success) {
          console.error('[POS] Failed to deduct money:', deductResult.message);
          await this.sendPaymentSMS(phoneNumber, `Payment failed: ${deductResult.message}`, orderId);
          return;
        }

        // Update stock
        for (const item of pendingOrder.items) {
          const product = products.get(item.productId);
          product.stock -= item.quantity;
          products.set(item.productId, product);
        }

        // Create completed order
        const completedOrder = {
          ...pendingOrder,
          status: 'completed',
          paymentConfirmedAt: new Date(),
          transactionId: `TX${Date.now()}${Math.random().toString(36).substr(2, 4)}`
        };

        // Save to order history
        const userOrders = orderHistory.get(phoneNumber) || [];
        userOrders.push(completedOrder);
        orderHistory.set(phoneNumber, userOrders);

        // Clear cart
        this.clearCart(phoneNumber);

        // Remove from pending orders
        this.pendingOrders.delete(orderId);

        console.log(`[POS] Payment confirmed for order ${orderId}`);

        // Send SMS confirmation
        const smsMessage = `Payment Confirmed!
Order: ${orderId}
Amount: ${pendingOrder.total} TZS
Items: ${pendingOrder.items.length}
Balance: ${deductResult.newBalance} TZS
Thank you for shopping with us!`;

        await this.sendPaymentSMS(phoneNumber, smsMessage, orderId);

      } else {
        // Payment cancelled/failed
        console.log(`[POS] Payment cancelled for order ${orderId}`);
        
        // Remove from pending orders
        this.pendingOrders.delete(orderId);

        // Send SMS notification
        await this.sendPaymentSMS(pendingOrder.phoneNumber, `Payment cancelled for order ${orderId}. Items remain in cart.`, orderId);
      }

    } catch (error) {
      console.error('[POS] Payment confirmation error:', error);
    }
  }

  // Send SMS confirmation
  static async sendPaymentSMS(phoneNumber, message, orderId) {
    try {
      const at = require('../config/at');
      const sms = at.SMS;
      
      const options = {
        to: [phoneNumber],
        message: message
      };

      // Add sender ID if not in sandbox
      const isSandbox = (process.env.AT_USERNAME || 'sandbox') === 'sandbox';
      if (!isSandbox && process.env.AT_FROM_SHORTCODE) {
        options.from = String(process.env.AT_FROM_SHORTCODE);
      }

      console.log(`[POS] Sending SMS confirmation for order ${orderId} to ${phoneNumber}`);
      
      const response = await sms.send(options);
      const firstRecipient = response?.SMSMessageData?.Recipients?.[0];
      
      console.log('[POS] SMS sent:', {
        status: firstRecipient?.status || 'UNKNOWN',
        statusCode: firstRecipient?.statusCode,
        messageId: firstRecipient?.messageId,
        cost: firstRecipient?.cost,
      });

    } catch (error) {
      console.error('[POS] SMS sending error:', error);
    }
  }

  // Get order history
  static getOrderHistory(phoneNumber, limit = 5) {
    const orders = orderHistory.get(phoneNumber) || [];
    return orders.slice(-limit).reverse(); // Get last N orders, newest first
  }

  // Get categories
  static getCategories() {
    const categories = new Set();
    products.forEach(product => categories.add(product.category));
    return Array.from(categories);
  }
}

module.exports = POSService;