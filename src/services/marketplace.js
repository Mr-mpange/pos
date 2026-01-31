const PaymentService = require('./payments');
const SupabaseService = require('./supabase-client');

// Shopping carts for each user (in production, use Redis or database)
const userCarts = new Map();
const orderHistory = new Map();

class MarketplaceService {
  
  // Get all products or by category/region
  static async getProducts(category = null, region = null) {
    try {
      const result = await SupabaseService.getProducts(category, region);
      if (!result.success) {
        console.error('[Marketplace] Error fetching products:', result.error);
        return [];
      }
      return result.data;
    } catch (error) {
      console.error('[Marketplace] Error in getProducts:', error);
      return [];
    }
  }

  // Search products by name or description
  static async searchProducts(query, region = null) {
    try {
      const result = await SupabaseService.searchProducts(query, region);
      if (!result.success) {
        console.error('[Marketplace] Error searching products:', result.error);
        return [];
      }
      return result.data;
    } catch (error) {
      console.error('[Marketplace] Error in searchProducts:', error);
      return [];
    }
  }

  // Get product by ID
  static async getProduct(productId) {
    try {
      const result = await SupabaseService.getProduct(productId);
      if (!result.success) {
        console.error('[Marketplace] Error fetching product:', result.error);
        return null;
      }
      return result.data;
    } catch (error) {
      console.error('[Marketplace] Error in getProduct:', error);
      return null;
    }
  }

  // Get all categories
  static async getCategories() {
    try {
      const result = await SupabaseService.getCategories();
      if (!result.success) {
        console.error('[Marketplace] Error fetching categories:', result.error);
        return [];
      }
      return result.data.map(cat => cat.name);
    } catch (error) {
      console.error('[Marketplace] Error in getCategories:', error);
      return [];
    }
  }

  // Get all vendors
  static async getVendors(region = null) {
    try {
      const result = await SupabaseService.getVendors(region);
      if (!result.success) {
        console.error('[Marketplace] Error fetching vendors:', result.error);
        return [];
      }
      return result.data;
    } catch (error) {
      console.error('[Marketplace] Error in getVendors:', error);
      return [];
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
        return { success: false, message: `Only ${product.stock} ${product.unit}(s) of ${product.name} available` };
      }

      const cart = this.getCart(phoneNumber);
      const existingItem = cart.items.find(item => item.productId === productId);

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (product.stock < newQuantity) {
          return { success: false, message: `Only ${product.stock} ${product.unit}(s) of ${product.name} available` };
        }
        existingItem.quantity = newQuantity;
        existingItem.subtotal = existingItem.quantity * product.price;
      } else {
        cart.items.push({
          productId,
          name: product.name,
          price: product.price,
          unit: product.unit,
          quantity,
          subtotal: quantity * product.price,
          vendorId: product.vendorId,
          vendorName: product.vendorName,
          vendorPhone: product.vendorPhone
        });
      }

      cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
      userCarts.set(phoneNumber, cart);
      
      console.log(`[Marketplace] Cart after adding ${product.name}:`, JSON.stringify(cart, null, 2));

      return {
        success: true,
        message: `Added ${quantity} ${product.unit}(s) of ${product.name} to cart. Cart total: ${cart.total.toLocaleString()} TZS`,
        cart
      };

    } catch (error) {
      console.error('[Marketplace] Error in addToCart:', error);
      return { success: false, message: 'Failed to add item to cart' };
    }
  }

  // Remove item from cart
  static removeFromCart(phoneNumber, productId) {
    const cart = this.getCart(phoneNumber);
    const removedItem = cart.items.find(item => item.productId === productId);
    cart.items = cart.items.filter(item => item.productId !== productId);
    cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    userCarts.set(phoneNumber, cart);

    return {
      success: true,
      message: removedItem ? `Removed ${removedItem.name} from cart` : 'Item removed from cart',
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
  static async processCheckout(phoneNumber, customerName = null, customerLocation = null) {
    const cart = this.getCart(phoneNumber);
    
    if (cart.items.length === 0) {
      return { success: false, message: 'Cart is empty' };
    }

    try {
      // Check stock availability for all items
      for (const item of cart.items) {
        const product = await this.getProduct(item.productId);
        if (!product || product.stock < item.quantity) {
          return {
            success: false,
            message: `${item.name} out of stock. Only ${product ? product.stock : 0} available`
          };
        }
      }

      // Generate order ID
      const orderId = `MKT${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
      
      // Group items by vendor for multiple orders if needed
      const vendorGroups = new Map();
      cart.items.forEach(item => {
        if (!vendorGroups.has(item.vendorId)) {
          vendorGroups.set(item.vendorId, {
            vendorId: item.vendorId,
            vendorName: item.vendorName,
            vendorPhone: item.vendorPhone,
            items: [],
            total: 0
          });
        }
        const group = vendorGroups.get(item.vendorId);
        group.items.push(item);
        group.total += item.subtotal;
      });

      // For now, we'll create one order with the primary vendor
      const primaryVendor = Array.from(vendorGroups.values())[0];
      
      // Initiate PUSH payment request
      const pushResult = await this.initiatePushPayment(phoneNumber, cart.total, orderId);
      
      if (!pushResult.success) {
        return pushResult;
      }

      // Store pending order
      const pendingOrder = {
        id: orderId,
        phoneNumber,
        customerName: customerName || phoneNumber,
        customerLocation: customerLocation || 'Not specified',
        vendorId: primaryVendor.vendorId,
        vendorName: primaryVendor.vendorName,
        vendorPhone: primaryVendor.vendorPhone,
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

      console.log(`[Marketplace] PUSH payment initiated for order ${orderId}`);
      
      return {
        success: true,
        message: `Payment request sent to ${phoneNumber}. Please check your phone and enter PIN to confirm payment of ${cart.total.toLocaleString()} TZS`,
        orderId,
        status: 'pending_payment'
      };

    } catch (error) {
      console.error('[Marketplace] Checkout error:', error);
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
      
      console.log(`[Marketplace] Initiating ${isSandbox ? 'SANDBOX' : 'LIVE'} PUSH payment: ${amount.toLocaleString()} TZS to ${phoneNumber} for order ${orderId}`);
      
      if (isSandbox) {
        // Sandbox mode - simulate payment
        const autoConfirmDelay = parseInt(process.env.SANDBOX_AUTO_CONFIRM_DELAY) || 3000;
        const successRate = parseFloat(process.env.SANDBOX_SUCCESS_RATE) || 0.9;
        const willSucceed = Math.random() < successRate;
        
        console.log(`[Marketplace] SANDBOX: Will ${willSucceed ? 'succeed' : 'fail'} after ${autoConfirmDelay}ms`);
        
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
      console.error('[Marketplace] PUSH payment error:', error);
      return {
        success: false,
        message: 'Failed to initiate payment'
      };
    }
  }

  // Live payment integration (to be implemented with real payment gateway)
  static async initiateLivePayment(phoneNumber, amount, orderId, requestId) {
    try {
      console.log(`[Marketplace] LIVE PAYMENT: Initiating real payment for ${amount} TZS to ${phoneNumber}`);
      
      // TODO: Integrate with real mobile money API (M-Pesa, Tigo Pesa, Airtel Money, etc.)
      // Example integration points:
      // - Vodacom M-Pesa API
      // - Tigo Pesa API  
      // - Airtel Money API
      // - CRDB Bank Mobile Money
      // - NMB Mobile Money
      
      const liveGatewayUrl = process.env.LIVE_PAYMENT_GATEWAY_URL;
      const liveApiKey = process.env.LIVE_PAYMENT_API_KEY;
      
      if (!liveGatewayUrl || !liveApiKey) {
        console.error('[Marketplace] LIVE PAYMENT: Missing gateway configuration');
        return {
          success: false,
          message: 'Payment gateway not configured. Please contact support.'
        };
      }
      
      // Example implementation (replace with actual payment gateway)
      /*
      const paymentRequest = {
        phoneNumber: phoneNumber,
        amount: amount,
        currency: 'TZS',
        reference: orderId,
        description: `Soko Connect Order ${orderId}`,
        callbackUrl: `${process.env.BASE_URL}/api/payment-callback`
      };
      
      const response = await fetch(liveGatewayUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${liveApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentRequest)
      });
      
      const result = await response.json();
      
      if (result.success) {
        return {
          success: true,
          requestId: result.transactionId || requestId,
          message: 'Payment request sent to your phone'
        };
      } else {
        return {
          success: false,
          message: result.message || 'Payment initiation failed'
        };
      }
      */
      
      // For now, return error since live payment is not implemented
      return {
        success: false,
        message: 'Live payments not yet implemented. Please use sandbox mode for testing.'
      };
      
    } catch (error) {
      console.error('[Marketplace] Live payment error:', error);
      return {
        success: false,
        message: 'Live payment service temporarily unavailable'
      };
    }
  }

  // Confirm payment and update database
  static async confirmPayment(orderId, requestId, isConfirmed) {
    try {
      if (!this.pendingOrders) {
        console.error('[Marketplace] No pending orders found');
        return;
      }

      const pendingOrder = this.pendingOrders.get(orderId);
      if (!pendingOrder) {
        console.error(`[Marketplace] Pending order ${orderId} not found`);
        return;
      }

      if (isConfirmed) {
        // Process successful payment
        const phoneNumber = pendingOrder.phoneNumber;
        
        // Deduct money from user balance
        const deductResult = PaymentService.deductMoney(phoneNumber, pendingOrder.total);
        if (!deductResult.success) {
          console.error('[Marketplace] Failed to deduct money:', deductResult.message);
          await this.sendPaymentSMS(phoneNumber, `Payment failed: ${deductResult.message}`, orderId);
          return;
        }

        // Create order in database
        const orderData = {
          vendorId: pendingOrder.vendorId,
          customerName: pendingOrder.customerName,
          customerPhone: pendingOrder.phoneNumber,
          customerLocation: pendingOrder.customerLocation,
          totalAmount: pendingOrder.total,
          notes: `Order from marketplace POS - ${pendingOrder.items.length} items`,
          items: pendingOrder.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.subtotal
          }))
        };

        const orderResult = await SupabaseService.createOrder(orderData);
        if (!orderResult.success) {
          console.error('[Marketplace] Failed to create order:', orderResult.error);
          // Refund the money
          PaymentService.addMoney(phoneNumber, pendingOrder.total);
          await this.sendPaymentSMS(phoneNumber, `Order creation failed. Money refunded.`, orderId);
          return;
        }

        // Update stock for all items
        for (const item of pendingOrder.items) {
          const stockResult = await SupabaseService.updateProductStock(item.productId, item.quantity);
          if (!stockResult.success) {
            console.error(`[Marketplace] Failed to update stock for ${item.name}:`, stockResult.error);
          }
        }

        // Update order status to completed
        await SupabaseService.updateOrderStatus(orderResult.data.id, 'completed');

        // Create completed order for local history
        const completedOrder = {
          ...pendingOrder,
          status: 'completed',
          paymentConfirmedAt: new Date(),
          transactionId: `TX${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
          databaseOrderId: orderResult.data.id,
          orderNumber: orderResult.data.order_number
        };

        // Save to order history
        const userOrders = orderHistory.get(phoneNumber) || [];
        userOrders.push(completedOrder);
        orderHistory.set(phoneNumber, userOrders);

        // Clear cart
        this.clearCart(phoneNumber);

        // Remove from pending orders
        this.pendingOrders.delete(orderId);

        console.log(`[Marketplace] Payment confirmed for order ${orderId} (DB: ${orderResult.data.order_number})`);

        // Send SMS confirmation to buyer
        const buyerSMS = `Payment Confirmed!
Order: ${orderResult.data.order_number}
Amount: ${pendingOrder.total.toLocaleString()} TZS
Items: ${pendingOrder.items.length}
Vendor: ${pendingOrder.vendorName}
Balance: ${deductResult.newBalance.toLocaleString()} TZS
Thank you for shopping with Soko Connect!`;

        // Send SMS to vendor
        const vendorSMS = `New Order Received!
Order: ${orderResult.data.order_number}
Customer: ${pendingOrder.customerName} (${phoneNumber})
Amount: ${pendingOrder.total.toLocaleString()} TZS
Items: ${pendingOrder.items.map(item => `${item.quantity} ${item.unit}(s) ${item.name}`).join(', ')}
Location: ${pendingOrder.customerLocation}
Time: ${new Date().toLocaleString()}`;

        // Send SMS to buyer
        await this.sendPaymentSMS(phoneNumber, buyerSMS, orderId, 'buyer');
        
        // Send SMS to vendor
        await this.sendPaymentSMS(pendingOrder.vendorPhone, vendorSMS, orderId, 'vendor');

      } else {
        // Payment cancelled/failed
        console.log(`[Marketplace] Payment cancelled for order ${orderId}`);
        
        // Remove from pending orders
        this.pendingOrders.delete(orderId);

        // Send SMS notification
        const cancelSMS = `Payment cancelled for order ${orderId}. Items remain in cart.`;
        await this.sendPaymentSMS(pendingOrder.phoneNumber, cancelSMS, orderId, 'buyer');
      }

    } catch (error) {
      console.error('[Marketplace] Payment confirmation error:', error);
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

      console.log(`[Marketplace] Sending SMS to ${recipient} (${phoneNumber}) for order ${orderId}`);
      
      const response = await sms.send(options);
      const firstRecipient = response?.SMSMessageData?.Recipients?.[0];
      
      console.log(`[Marketplace] SMS sent to ${recipient}:`, {
        status: firstRecipient?.status || 'UNKNOWN',
        statusCode: firstRecipient?.statusCode,
        messageId: firstRecipient?.messageId,
        cost: firstRecipient?.cost,
      });

    } catch (error) {
      console.error(`[Marketplace] SMS sending error to ${recipient}:`, error);
    }
  }

  // Get order history
  static getOrderHistory(phoneNumber, limit = 5) {
    const orders = orderHistory.get(phoneNumber) || [];
    return orders.slice(-limit).reverse(); // Get last N orders, newest first
  }

  // Get product recommendations based on region or category
  static async getRecommendations(phoneNumber, region = null, category = null, limit = 5) {
    try {
      const products = await this.getProducts(category, region);
      
      // Sort by trust score and stock availability
      const recommendations = products
        .filter(p => p.stock > 0)
        .sort((a, b) => {
          // Prioritize verified vendors and higher trust scores
          if (a.isVerified !== b.isVerified) {
            return b.isVerified - a.isVerified;
          }
          return (b.trustScore || 0) - (a.trustScore || 0);
        })
        .slice(0, limit);

      return recommendations;

    } catch (error) {
      console.error('[Marketplace] Error getting recommendations:', error);
      return [];
    }
  }
}

module.exports = MarketplaceService;