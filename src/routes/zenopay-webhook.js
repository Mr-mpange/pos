const express = require('express');
const ZenoPayService = require('../services/zenopay');
const POSService = require('../services/pos');

const router = express.Router();

// ZenoPay webhook handler
router.post('/webhook', async (req, res) => {
  try {
    console.log('[ZenoPay Webhook] Received webhook:', req.body);
    
    const { orderId, status, amount, phoneNumber, timestamp, signature } = req.body;
    
    // Verify webhook signature
    const zenoPayService = new ZenoPayService();
    const isValidSignature = zenoPayService.verifyWebhookSignature(
      req.body,
      signature,
      timestamp
    );
    
    if (!isValidSignature) {
      console.error('[ZenoPay Webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Find the corresponding POS order
    let posOrderId = null;
    if (POSService.zenoPayOrders) {
      for (const [posId, zenoPayData] of POSService.zenoPayOrders.entries()) {
        if (zenoPayData.zenoPayOrderId === orderId) {
          posOrderId = posId;
          break;
        }
      }
    }
    
    if (!posOrderId) {
      console.warn('[ZenoPay Webhook] No matching POS order found for ZenoPay order:', orderId);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    console.log(`[ZenoPay Webhook] Processing webhook for POS order ${posOrderId}, ZenoPay order ${orderId}, status: ${status}`);
    
    // Process the payment based on status
    const isSuccess = status.toLowerCase() === 'completed' || status.toLowerCase() === 'success';
    
    // Confirm payment in POS system
    await POSService.confirmPayment(posOrderId, orderId, isSuccess);
    
    // Clean up ZenoPay order tracking
    if (POSService.zenoPayOrders) {
      POSService.zenoPayOrders.delete(posOrderId);
    }
    
    console.log(`[ZenoPay Webhook] Successfully processed webhook for order ${posOrderId}`);
    
    // Respond to ZenoPay
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      posOrderId,
      zenoPayOrderId: orderId
    });
    
  } catch (error) {
    console.error('[ZenoPay Webhook] Error processing webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get ZenoPay payment status (for manual checking)
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const zenoPayService = new ZenoPayService();
    const statusResult = await zenoPayService.checkPaymentStatus(orderId);
    
    res.json(statusResult);
    
  } catch (error) {
    console.error('[ZenoPay Status] Error checking status:', error);
    res.status(500).json({ 
      error: 'Failed to check payment status',
      message: error.message 
    });
  }
});

// Get supported mobile money providers
router.get('/providers', (req, res) => {
  try {
    const zenoPayService = new ZenoPayService();
    const providers = zenoPayService.getSupportedProviders();
    
    res.json({
      success: true,
      providers
    });
    
  } catch (error) {
    console.error('[ZenoPay Providers] Error getting providers:', error);
    res.status(500).json({ 
      error: 'Failed to get providers',
      message: error.message 
    });
  }
});

// Test ZenoPay connection
router.get('/test', async (req, res) => {
  try {
    const zenoPayService = new ZenoPayService();
    
    // Test with a small amount and test phone number
    const testResult = await zenoPayService.createPaymentOrder(
      100, // 100 TZS
      '255712345678', // Test phone number
      'Test Customer',
      'test@example.com',
      'ZenoPay Connection Test'
    );
    
    res.json({
      success: true,
      message: 'ZenoPay connection test',
      mode: zenoPayService.isSandbox ? 'sandbox' : 'live',
      result: testResult
    });
    
  } catch (error) {
    console.error('[ZenoPay Test] Connection test failed:', error);
    res.status(500).json({ 
      error: 'ZenoPay connection test failed',
      message: error.message 
    });
  }
});

module.exports = router;