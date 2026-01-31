const at = require('../config/at');

class SMSService {
  constructor() {
    this.sms = at.SMS;
  }

  /**
   * Send SMS notification
   * @param {string} to - Phone number to send SMS to
   * @param {string} message - SMS message content
   * @param {string} from - Sender ID (optional)
   * @returns {Promise<Object>} SMS send result
   */
  async sendSMS(to, message, from = null) {
    try {
      console.log(`[SMS] Sending to ${to}: ${message.substring(0, 50)}...`);
      
      const options = {
        to: [to],
        message: message
      };
      
      // Add sender ID if provided
      if (from) {
        options.from = from;
      }
      
      const result = await this.sms.send(options);
      console.log('[SMS] Send result:', result);
      
      return {
        success: true,
        result: result,
        message: 'SMS sent successfully'
      };
    } catch (error) {
      console.error('[SMS] Send error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to send SMS'
      };
    }
  }

  /**
   * Send order confirmation SMS
   * @param {string} phoneNumber - Customer phone number
   * @param {Object} order - Order details
   * @param {string} lang - Language (en/sw)
   */
  async sendOrderConfirmation(phoneNumber, order, lang = 'en') {
    const messages = {
      en: {
        subject: 'Order Confirmation',
        body: `Order confirmed! Total: ${order.total.toLocaleString()} TZS. Items: ${order.items.length}. Order ID: ${order.id || 'N/A'}. Thank you for shopping with Soko Connect!`
      },
      sw: {
        subject: 'Uthibitisho wa Agizo',
        body: `Agizo limethibitishwa! Jumla: ${order.total.toLocaleString()} TZS. Bidhaa: ${order.items.length}. Nambari ya Agizo: ${order.id || 'Hakuna'}. Asante kwa ununuzi na Soko Connect!`
      }
    };
    
    const msg = messages[lang] || messages.en;
    return await this.sendSMS(phoneNumber, msg.body);
  }

  /**
   * Send balance inquiry SMS
   * @param {string} phoneNumber - Customer phone number
   * @param {Object} balance - Balance details
   * @param {string} lang - Language (en/sw)
   */
  async sendBalanceInquiry(phoneNumber, balance, lang = 'en') {
    const messages = {
      en: {
        body: `Your wallet balance: ${balance.balance.toLocaleString()} ${balance.currency}. Thank you for using Soko Connect!`
      },
      sw: {
        body: `Salio la pochi yako: ${balance.balance.toLocaleString()} ${balance.currency}. Asante kwa kutumia Soko Connect!`
      }
    };
    
    const msg = messages[lang] || messages.en;
    return await this.sendSMS(phoneNumber, msg.body);
  }

  /**
   * Send transaction confirmation SMS
   * @param {string} phoneNumber - Customer phone number
   * @param {Object} transaction - Transaction details
   * @param {string} lang - Language (en/sw)
   */
  async sendTransactionConfirmation(phoneNumber, transaction, lang = 'en') {
    const messages = {
      en: {
        body: `Transaction confirmed! Amount: ${transaction.amount.toLocaleString()} TZS. Type: ${transaction.type}. Thank you for using Soko Connect!`
      },
      sw: {
        body: `Muamala umethibitishwa! Kiasi: ${transaction.amount.toLocaleString()} TZS. Aina: ${transaction.type}. Asante kwa kutumia Soko Connect!`
      }
    };
    
    const msg = messages[lang] || messages.en;
    return await this.sendSMS(phoneNumber, msg.body);
  }

  /**
   * Send voice call instructions SMS
   * @param {string} phoneNumber - Customer phone number
   * @param {string} voiceNumber - Voice shopping number
   * @param {string} lang - Language (en/sw)
   */
  async sendVoiceInstructions(phoneNumber, voiceNumber, lang = 'en') {
    const messages = {
      en: {
        body: `Voice Shopping: Call ${voiceNumber} anytime for voice shopping. Choose your language then follow voice prompts to shop. Soko Connect - Shop Smart!`
      },
      sw: {
        body: `Ununuzi wa Sauti: Piga simu ${voiceNumber} wakati wowote kwa ununuzi wa sauti. Chagua lugha yako kisha fuata maelekezo ya sauti kununua. Soko Connect - Nunua Kwa Akili!`
      }
    };
    
    const msg = messages[lang] || messages.en;
    return await this.sendSMS(phoneNumber, msg.body);
  }

  /**
   * Send order history SMS
   * @param {string} phoneNumber - Customer phone number
   * @param {Array} orders - Order history
   * @param {string} lang - Language (en/sw)
   */
  async sendOrderHistory(phoneNumber, orders, lang = 'en') {
    if (orders.length === 0) {
      const messages = {
        en: { body: 'No previous orders found. Start shopping with USSD *384*123# or call +255699997983 for voice shopping!' },
        sw: { body: 'Hakuna maagizo ya awali. Anza ununuzi kwa USSD *384*123# au piga simu +255699997983 kwa ununuzi wa sauti!' }
      };
      const msg = messages[lang] || messages.en;
      return await this.sendSMS(phoneNumber, msg.body);
    }

    const messages = {
      en: { title: 'Recent Orders:' },
      sw: { title: 'Maagizo ya Hivi Karibuni:' }
    };
    
    const msg = messages[lang] || messages.en;
    let smsBody = msg.title + '\n';
    
    orders.forEach((order, index) => {
      const totalFormatted = order.total.toLocaleString();
      smsBody += `${index + 1}. ${order.orderNumber || order.id}: ${totalFormatted} TZS (${order.items.length} ${lang === 'sw' ? 'bidhaa' : 'items'})\n`;
    });
    
    smsBody += lang === 'sw' ? 'Asante kwa kutumia Soko Connect!' : 'Thank you for using Soko Connect!';
    
    return await this.sendSMS(phoneNumber, smsBody);
  }
}

module.exports = new SMSService();