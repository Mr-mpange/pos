// Payment configuration utility
class PaymentConfig {
  
  static getMode() {
    return process.env.PAYMENT_MODE || 'sandbox';
  }
  
  static isSandbox() {
    return this.getMode() === 'sandbox';
  }
  
  static isLive() {
    return this.getMode() === 'live';
  }
  
  static getSandboxConfig() {
    return {
      autoConfirmDelay: parseInt(process.env.SANDBOX_AUTO_CONFIRM_DELAY) || 3000,
      successRate: parseFloat(process.env.SANDBOX_SUCCESS_RATE) || 0.9,
      enabled: this.isSandbox()
    };
  }
  
  static getLiveConfig() {
    return {
      gatewayUrl: process.env.LIVE_PAYMENT_GATEWAY_URL,
      apiKey: process.env.LIVE_PAYMENT_API_KEY,
      secret: process.env.LIVE_PAYMENT_SECRET,
      enabled: this.isLive(),
      isConfigured: !!(process.env.LIVE_PAYMENT_GATEWAY_URL && process.env.LIVE_PAYMENT_API_KEY)
    };
  }
  
  static getPaymentMessage(isSandbox = null) {
    if (isSandbox === null) {
      isSandbox = this.isSandbox();
    }
    
    if (isSandbox) {
      return 'SANDBOX: Payment request sent (simulated). Check your phone and enter PIN to confirm payment.';
    } else {
      return 'Payment request sent to your phone. Please check your phone and enter PIN to confirm payment.';
    }
  }
  
  static validateConfig() {
    const mode = this.getMode();
    const errors = [];
    
    if (!['sandbox', 'live'].includes(mode)) {
      errors.push(`Invalid PAYMENT_MODE: ${mode}. Must be 'sandbox' or 'live'`);
    }
    
    if (this.isLive()) {
      const liveConfig = this.getLiveConfig();
      if (!liveConfig.isConfigured) {
        errors.push('Live payment mode requires LIVE_PAYMENT_GATEWAY_URL and LIVE_PAYMENT_API_KEY');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      mode,
      config: this.isSandbox() ? this.getSandboxConfig() : this.getLiveConfig()
    };
  }
  
  static logConfig() {
    const validation = this.validateConfig();
    console.log(`[Payment Config] Mode: ${validation.mode.toUpperCase()}`);
    
    if (this.isSandbox()) {
      const config = this.getSandboxConfig();
      console.log(`[Payment Config] Sandbox - Auto confirm: ${config.autoConfirmDelay}ms, Success rate: ${config.successRate * 100}%`);
    } else {
      const config = this.getLiveConfig();
      console.log(`[Payment Config] Live - Gateway configured: ${config.isConfigured ? 'YES' : 'NO'}`);
    }
    
    if (!validation.valid) {
      console.error('[Payment Config] Validation errors:', validation.errors);
    }
    
    return validation;
  }
}

module.exports = PaymentConfig;