const axios = require('axios');

// Mock payment database - replace with real database
const paymentDB = new Map();
const userBalances = new Map();
const registeredUsers = new Set(); // Track users who have used the system

class PaymentService {
  
  // Register a user when they first interact with the system
  static registerUser(phoneNumber) {
    if (!registeredUsers.has(phoneNumber)) {
      registeredUsers.add(phoneNumber);
      // Give new users a starting balance in sandbox mode
      const isSandbox = (process.env.AT_USERNAME || 'sandbox') === 'sandbox';
      if (isSandbox && !userBalances.has(phoneNumber)) {
        userBalances.set(phoneNumber, { balance: 10000, currency: 'TZS' }); // 10k starting balance
        console.log(`[Payment] New user registered: ${phoneNumber} with 10,000 TZS`);
      }
    }
  }
  
  // Validate phone number based on environment
  static validatePhoneNumber(phoneNumber, senderPhone) {
    const isSandbox = (process.env.AT_USERNAME || 'sandbox') === 'sandbox';
    
    if (isSandbox) {
      // In sandbox, only allow transfers between registered users
      if (!registeredUsers.has(phoneNumber)) {
        return {
          valid: false,
          message: `Number ${phoneNumber} not registered. They need to send a message first to register.`
        };
      }
    } else {
      // In production, validate phone number format
      const phoneRegex = /^\+\d{10,15}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return {
          valid: false,
          message: 'Invalid phone number format. Use: +255683859574'
        };
      }
    }
    
    return { valid: true };
  }
  
  // Check user balance
  static getBalance(phoneNumber) {
    this.registerUser(phoneNumber); // Auto-register if not already
    const account = userBalances.get(phoneNumber);
    return account || { balance: 0, currency: 'TZS' };
  }

  // Process payment
  static async processPayment(fromPhone, toPhone, amount, description = '') {
    try {
      // Auto-register sender
      this.registerUser(fromPhone);
      
      // Validate recipient phone number
      const validation = this.validatePhoneNumber(toPhone, fromPhone);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.message
        };
      }

      // Check sender balance
      const fromAccount = userBalances.get(fromPhone);
      if (!fromAccount || fromAccount.balance < amount) {
        return {
          success: false,
          message: `Insufficient balance. Available: ${fromAccount?.balance || 0} TZS`
        };
      }

      // Check minimum amount
      if (amount < 100) {
        return {
          success: false,
          message: 'Minimum transfer amount is 100 TZS'
        };
      }

      // Auto-register recipient
      this.registerUser(toPhone);

      // Deduct from sender
      fromAccount.balance -= amount;
      userBalances.set(fromPhone, fromAccount);

      // Add to receiver (create account if doesn't exist)
      const toAccount = userBalances.get(toPhone) || { balance: 0, currency: 'TZS' };
      toAccount.balance += amount;
      userBalances.set(toPhone, toAccount);

      // Log transaction
      const txId = `TX${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
      paymentDB.set(txId, {
        id: txId,
        from: fromPhone,
        to: toPhone,
        amount,
        description,
        timestamp: new Date(),
        status: 'completed'
      });

      console.log(`[Payment] ${fromPhone} sent ${amount} TZS to ${toPhone} (${txId})`);
      
      return {
        success: true,
        message: `Payment successful! Sent ${amount} TZS to ${toPhone}. New balance: ${fromAccount.balance} TZS`,
        transactionId: txId
      };

    } catch (error) {
      console.error('[Payment] Error:', error);
      return {
        success: false,
        message: 'Payment failed. Please try again.'
      };
    }
  }

  // Get transaction history
  static getTransactions(phoneNumber, limit = 5) {
    this.registerUser(phoneNumber); // Auto-register if not already
    const transactions = Array.from(paymentDB.values())
      .filter(tx => tx.from === phoneNumber || tx.to === phoneNumber)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    return transactions;
  }

  // Add money (for demo purposes)
  static addMoney(phoneNumber, amount) {
    this.registerUser(phoneNumber); // Auto-register if not already
    const account = userBalances.get(phoneNumber) || { balance: 0, currency: 'TZS' };
    account.balance += amount;
    userBalances.set(phoneNumber, account);
    return account;
  }

  // Deduct money from user account
  static deductMoney(phoneNumber, amount) {
    this.registerUser(phoneNumber); // Auto-register if not already
    const account = userBalances.get(phoneNumber);
    
    if (!account || account.balance < amount) {
      return {
        success: false,
        message: `Insufficient balance. Available: ${account?.balance || 0} TZS, Required: ${amount} TZS`
      };
    }
    
    account.balance -= amount;
    userBalances.set(phoneNumber, account);
    
    console.log(`[Payment] Deducted ${amount} TZS from ${phoneNumber}. New balance: ${account.balance} TZS`);
    
    return {
      success: true,
      message: `Deducted ${amount} TZS successfully`,
      newBalance: account.balance
    };
  }

  // Get registered users count
  static getRegisteredUsersCount() {
    return registeredUsers.size;
  }

  // Check if user is registered
  static isUserRegistered(phoneNumber) {
    return registeredUsers.has(phoneNumber);
  }
}

module.exports = PaymentService;