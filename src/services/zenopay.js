const crypto = require('crypto');

class ZenoPayService {
  constructor() {
    this.isSandbox = process.env.PAYMENT_MODE === 'sandbox';
    
    if (this.isSandbox) {
      this.baseUrl = process.env.ZENOPAY_SANDBOX_URL || 'https://zenoapi.com/api';
      this.accountId = process.env.ZENOPAY_SANDBOX_ACCOUNT_ID;
      this.apiKey = process.env.ZENOPAY_SANDBOX_API_KEY;
      this.secretKey = process.env.ZENOPAY_SANDBOX_SECRET_KEY;
    } else {
      this.baseUrl = process.env.ZENOPAY_BASE_URL || 'https://zenoapi.com/api';
      this.accountId = process.env.ZENOPAY_ACCOUNT_ID;
      this.apiKey = process.env.ZENOPAY_API_KEY;
      this.secretKey = process.env.ZENOPAY_SECRET_KEY;
    }
    
    console.log(`[ZenoPay] Initialized in ${this.isSandbox ? 'SANDBOX' : 'LIVE'} mode`);
    console.log(`[ZenoPay] Base URL: ${this.baseUrl}`);
    console.log(`[ZenoPay] Account ID: ${this.accountId}`);
  }

  // Generate signature for API requests
  generateSignature(payload, timestamp) {
    if (!this.secretKey) {
      throw new Error('ZenoPay secret key not configured');
    }
    const message = `${timestamp}${JSON.stringify(payload)}`;
    return crypto.createHmac('sha256', this.secretKey).update(message).digest('hex');
  }

  // Make authenticated API request to ZenoPay
  async makeRequest(endpoint, method = 'POST', payload = {}) {
    try {
      if (!this.accountId || !this.apiKey || !this.secretKey) {
        throw new Error('ZenoPay credentials not configured. Please set ZENOPAY_ACCOUNT_ID, ZENOPAY_API_KEY, and ZENOPAY_SECRET_KEY in your .env file.');
      }

      const timestamp = Date.now().toString();
      const signature = this.generateSignature(payload, timestamp);
      
      const headers = {
        'Content-Type': 'application/json',
        'x-account-id': this.accountId,
        'x-client-id': this.apiKey,
        'x-timestamp': timestamp,
        'x-signature': signature
      };

      console.log(`[ZenoPay] Making ${method} request to ${endpoint}`);
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: method !== 'GET' ? JSON.stringify(payload) : undefined
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`[ZenoPay] API Error:`, data);
        throw new Error(data.message || 'ZenoPay API request failed');
      }

      console.log(`[ZenoPay] API Response:`, data);
      return data;
    } catch (error) {
      console.error(`[ZenoPay] Request failed:`, error);
      throw error;
    }
  }

  // Create payment order for mobile money deposit
  async createPaymentOrder(amount, phoneNumber, customerName, email, description = 'POS Payment') {
    try {
      // Validate phone number format (Tanzania)
      const cleanPhone = phoneNumber.replace(/^\+/, '');
      if (!cleanPhone.match(/^255[67]\d{8}$/)) {
        throw new Error('Invalid Tanzania phone number format');
      }

      const payload = {
        amount: amount.toString(),
        currency: 'TZS',
        customerName: customerName || 'POS Customer',
        phoneNumber: cleanPhone,
        email: email || 'customer@sokoconnect.com',
        description,
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/zenopay/webhook`,
        metadata: {
          source: 'pos_system',
          timestamp: new Date().toISOString()
        }
      };

      const response = await this.makeRequest('/payments/create', 'POST', payload);
      
      return {
        success: true,
        orderId: response.orderId,
        paymentUrl: response.paymentUrl,
        ussdCode: response.ussdCode,
        status: response.status,
        message: 'Payment order created successfully'
      };
    } catch (error) {
      console.error('[ZenoPay] Create payment order failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to create payment order'
      };
    }
  }

  // Check payment status
  async checkPaymentStatus(orderId) {
    try {
      const response = await this.makeRequest(`/payments/${orderId}/status`, 'GET');
      
      return {
        success: true,
        orderId: response.orderId,
        status: response.status,
        amount: response.amount,
        currency: response.currency,
        phoneNumber: response.phoneNumber,
        completedAt: response.completedAt,
        failureReason: response.failureReason
      };
    } catch (error) {
      console.error('[ZenoPay] Check payment status failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to check payment status'
      };
    }
  }

  // Process mobile money withdrawal
  async processWithdrawal(amount, phoneNumber, customerName, description = 'POS Withdrawal') {
    try {
      // Validate phone number format (Tanzania)
      const cleanPhone = phoneNumber.replace(/^\+/, '');
      if (!cleanPhone.match(/^255[67]\d{8}$/)) {
        throw new Error('Invalid Tanzania phone number format');
      }

      const payload = {
        amount: amount.toString(),
        currency: 'TZS',
        customerName: customerName || 'POS Customer',
        phoneNumber: cleanPhone,
        description,
        metadata: {
          source: 'pos_system',
          type: 'withdrawal',
          timestamp: new Date().toISOString()
        }
      };

      const response = await this.makeRequest('/withdrawals/create', 'POST', payload);
      
      return {
        success: true,
        withdrawalId: response.withdrawalId,
        status: response.status,
        message: 'Withdrawal initiated successfully'
      };
    } catch (error) {
      console.error('[ZenoPay] Process withdrawal failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to process withdrawal'
      };
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature, timestamp) {
    try {
      const expectedSignature = this.generateSignature(payload, timestamp);
      
      // Ensure both signatures are the same length
      if (signature.length !== expectedSignature.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('[ZenoPay] Webhook signature verification failed:', error);
      return false;
    }
  }

  // Get supported mobile money providers
  getSupportedProviders() {
    return [
      {
        name: 'M-Pesa (Vodacom)',
        code: 'MPESA',
        ussdCode: '*150*00#',
        prefixes: ['0754', '0755', '0756']
      },
      {
        name: 'Tigo Pesa',
        code: 'TIGO',
        ussdCode: '*150*01#',
        prefixes: ['0714', '0715', '0716', '0717']
      },
      {
        name: 'Airtel Money',
        code: 'AIRTEL',
        ussdCode: '*150*60#',
        prefixes: ['0754', '0755', '0756', '0757']
      },
      {
        name: 'Halotel Money',
        code: 'HALOTEL',
        ussdCode: '*150*88#',
        prefixes: ['0621', '0622', '0623']
      }
    ];
  }

  // Detect mobile money provider from phone number
  detectProvider(phoneNumber) {
    const cleanPhone = phoneNumber.replace(/^\+?255/, '');
    const prefix = cleanPhone.substring(0, 4);
    
    const providers = this.getSupportedProviders();
    
    for (const provider of providers) {
      if (provider.prefixes.some(p => prefix.startsWith(p.substring(1)))) {
        return provider;
      }
    }
    
    return null;
  }

  // Format phone number for Tanzania
  formatPhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle different formats
    if (cleaned.startsWith('255')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      return `+255${cleaned.substring(1)}`;
    } else if (cleaned.length === 9) {
      return `+255${cleaned}`;
    }
    
    throw new Error('Invalid phone number format');
  }

  // Get transaction fees
  getTransactionFees(amount) {
    // ZenoPay fee structure (example - adjust based on actual rates)
    const baseAmount = parseFloat(amount);
    let fee = 0;
    
    if (baseAmount <= 1000) {
      fee = 50;
    } else if (baseAmount <= 5000) {
      fee = 100;
    } else if (baseAmount <= 10000) {
      fee = 200;
    } else if (baseAmount <= 50000) {
      fee = 500;
    } else {
      fee = Math.ceil(baseAmount * 0.01); // 1% for large amounts
    }
    
    return {
      amount: baseAmount,
      fee,
      total: baseAmount + fee,
      currency: 'TZS'
    };
  }
}

module.exports = ZenoPayService;