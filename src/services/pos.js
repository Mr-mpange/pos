const PaymentService = require('./payments');
const SupabaseService = require('./supabase-client');

// Shopping carts for each user
const userCarts = new Map();
const orderHistory = new Map();

class POSService {
  
  // Get all products or by category
  static async getProducts(category = null) {
    try {
      const result = await SupabaseService.getProducts(category);
      if (!result.success) {
        console.error('[POS] Error fetching products:', result.error);
        return [];
      }
      return result.data;
    } catch (error) {
      console.error('[POS] Error in getProducts:', error);
      return [];
    }
  }

  // Search products by name
  static async searchProducts(query) {
    try {
      const result = await SupabaseService.searchProducts(query);
      if (!result.success) {
        console.error('[POS] Error searching products:', result.error);
        return [];
      }
      return result.data;
    } catch (error) {
      console.error('[POS] Error in searchProducts:', error);
      return [];
    }
  }

  // Get product by ID
  static async getProduct(productId) {
    try {
      const result = await SupabaseService.getProduct(productId);
      if (!result.success) {
        console.error('[POS] Error fetching product:', result.error);
        return null;
      }
      return result.data;
    } catch (error) {
      console.error('[POS] Error in getProduct:', error);
      return null;
    }
  }

  // Get user's cart
  static getCart(phoneNumber) {
    return userCarts.get(phoneNumber) || { items: [], total: 0 };
  }

  // Add item to cart
  static async addToCart(phoneNumber, productId, quantity = 1) {
    try {
      const product = await this.getProduct(productId);
      if (!product) {
        return { success: false, message: 'Product not found' };
      }

      if (product.stock < quantity) {
        return { success: false, message: `Only ${product.stock} ${product.unit || 'units'} of ${product.name} available` };
      }

      const cart = this.getCart(phoneNumber);
      const existingItem = cart.items.find(item => item.productId === productId);

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (product.stock < newQuantity) {
          return { success: false, message: `Only ${product.stock} ${product.unit || 'units'} of ${product.name} available` };
        }
        existingItem.quantity = newQuantity;
        existingItem.subtotal = existingItem.quantity * product.price;
      } else {
        cart.items.push({
          productId,
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
      
      console.log(`[POS] Cart after adding ${product.name}:`, JSON.stringify(cart, null, 2));

      return {
        success: true,
        message: `Added ${quantity} ${product.unit || 'unit'}(s) of ${product.name} to cart. Cart total: ${cart.total.toLocaleString()} TZS`,
        cart
      };

    } catch (error) {
      console.error('[POS] Error in addToCart:', error);
      return { success: false, message: 'Failed to add item to cart' };
    }
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
    const cart = this.getCart(phoneNumber);
    const clearedItems = [...cart.items]; // Keep a copy of items being cleared
    const clearedTotal = cart.total;
    
    userCarts.delete(phoneNumber);
    
    // Build detailed message about what was cleared
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
      const requestId = `PUSH${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
      const paymentMode = process.env.PAYMENT_MODE || 'sandbox';
      const isSandbox = paymentMode === 'sandbox';
      
      console.log(`[POS] Initiating ${isSandbox ? 'SANDBOX' : 'LIVE'} PUSH payment: ${amount.toLocaleString()} TZS to ${phoneNumber} for order ${orderId}`);
      
      if (isSandbox) {
        // Sandbox mode - simulate payment
        const autoConfirmDelay = parseInt(process.env.SANDBOX_AUTO_CONFIRM_DELAY) || 3000;
        const successRate = parseFloat(process.env.SANDBOX_SUCCESS_RATE) || 0.9;
        const willSucceed = Math.random() < successRate;
        
        console.log(`[POS] SANDBOX: Will ${willSucceed ? 'succeed' : 'fail'} after ${autoConfirmDelay}ms`);
        
        // Simulate delay and auto-confirm payment
        setTimeout(async () => {
          await this.confirmPayment(orderId, requestId, willSucceed);
        }, autoConfirmDelay);
        
        return {
          success: true,
          requestId,
          message: 'SANDBOX: Payment request sent (simulated)'
        };
      } else {
        // Live mode - integrate with real payment gateway
        return await this.initiateLivePayment(phoneNumber, amount, orderId, requestId);
      }
      
    } catch (error) {
      console.error('[POS] PUSH payment error:', error);
      return {
        success: false,
        message: 'Failed to initiate payment'
      };
    }
  }

  // Live payment integration (to be implemented with real payment gateway)
  static async initiateLivePayment(phoneNumber, amount, orderId, requestId) {
    try {
      console.log(`[POS] LIVE PAYMENT: Initiating real payment for ${amount} TZS to ${phoneNumber}`);
      
      // TODO: Integrate with real mobile money API
      const liveGatewayUrl = process.env.LIVE_PAYMENT_GATEWAY_URL;
      const liveApiKey = process.env.LIVE_PAYMENT_API_KEY;
      
      if (!liveGatewayUrl || !liveApiKey) {
        console.error('[POS] LIVE PAYMENT: Missing gateway configuration');
        return {
          success: false,
          message: 'Payment gateway not configured. Please contact support.'
        };
      }
      
      // For now, return error since live payment is not implemented
      return {
        success: false,
        message: 'Live payments not yet implemented. Please use sandbox mode for testing.'
      };
      
    } catch (error) {
      console.error('[POS] Live payment error:', error);
      return {
        success: false,
        message: 'Live payment service temporarily unavailable'
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

        // Update stock in database
        for (const item of pendingOrder.items) {
          const stockResult = await SupabaseService.updateProductStock(item.productId, item.quantity);
          if (!stockResult.success) {
            console.error(`[POS] Failed to update stock for ${item.name}:`, stockResult.error);
          }
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

        // Send SMS confirmation to both buyer and merchant
        const buyerSMS = `Payment Confirmed!
Order: ${orderId}
Amount: ${pendingOrder.total} TZS
Items: ${pendingOrder.items.length}
Balance: ${deductResult.newBalance} TZS
Thank you for shopping with us!`;

        const merchantSMS = `New Sale Received!
Order: ${orderId}
Customer: ${phoneNumber}
Amount: ${pendingOrder.total} TZS
Items: ${pendingOrder.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
Time: ${new Date().toLocaleString()}`;

        // Send SMS to buyer
        await this.sendPaymentSMS(phoneNumber, buyerSMS, orderId, 'buyer');
        
        // Send SMS to merchant (store owner)
        const merchantNumber = process.env.MERCHANT_PHONE || '+255683859574'; // Default to your number
        await this.sendPaymentSMS(merchantNumber, merchantSMS, orderId, 'merchant');

      } else {
        // Payment cancelled/failed
        console.log(`[POS] Payment cancelled for order ${orderId}`);
        
        // Remove from pending orders
        this.pendingOrders.delete(orderId);

        // Send SMS notification to both buyer and merchant
        const cancelSMS = `Payment cancelled for order ${orderId}. Items remain in cart.`;
        await this.sendPaymentSMS(pendingOrder.phoneNumber, cancelSMS, orderId, 'buyer');
        
        // Notify merchant of cancelled order
        const merchantNumber = process.env.MERCHANT_PHONE || '+255683859574';
        const merchantCancelSMS = `Order Cancelled: ${orderId} - Customer: ${pendingOrder.phoneNumber}`;
        await this.sendPaymentSMS(merchantNumber, merchantCancelSMS, orderId, 'merchant');
      }

    } catch (error) {
      console.error('[POS] Payment confirmation error:', error);
    }
  }

  // Send SMS confirmation
  static async sendPaymentSMS(phoneNumber, message, orderId, recipient = 'buyer') {
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

      console.log(`[POS] Sending SMS to ${recipient} (${phoneNumber}) for order ${orderId}`);
      
      const response = await sms.send(options);
      const firstRecipient = response?.SMSMessageData?.Recipients?.[0];
      
      console.log(`[POS] SMS sent to ${recipient}:`, {
        status: firstRecipient?.status || 'UNKNOWN',
        statusCode: firstRecipient?.statusCode,
        messageId: firstRecipient?.messageId,
        cost: firstRecipient?.cost,
      });

    } catch (error) {
      console.error(`[POS] SMS sending error to ${recipient}:`, error);
    }
  }

  // Get order history
  static getOrderHistory(phoneNumber, limit = 5) {
    const orders = orderHistory.get(phoneNumber) || [];
    return orders.slice(-limit).reverse(); // Get last N orders, newest first
  }

  // Get categories
  static async getCategories() {
    try {
      const result = await SupabaseService.getCategories();
      if (!result.success) {
        console.error('[POS] Error fetching categories:', result.error);
        return [];
      }
      return result.data.map(cat => cat.name);
    } catch (error) {
      console.error('[POS] Error in getCategories:', error);
      return [];
    }
  }
}

module.exports = POSService;