# Market Connect Integration

This document explains how the POS system has been integrated with the Market Connect database to provide real product data, pricing, and vendor information.

## Overview

The POS system now connects directly to the Market Connect Supabase database, replacing the mock data with real marketplace information. This enables customers to browse and purchase actual products from verified vendors through SMS, USSD, and voice interfaces.

## Integration Components

### 1. Supabase Client (`src/services/supabase-client.js`)
- Direct connection to Market Connect database
- Handles product queries, vendor information, and order management
- Provides async methods for all database operations

### 2. Updated Marketplace Service (`src/services/marketplace.js`)
- Wrapper around Supabase client for marketplace-specific operations
- Manages shopping carts and order processing
- Integrates with payment system for complete checkout flow

### 3. Enhanced AI Service (`src/services/ai.js`)
- Updated to use real product data in SMS conversations
- Provides intelligent product recommendations
- Handles natural language queries about marketplace items

### 4. USSD Interface Updates (`src/routes/ussd.js`)
- Now displays real products with vendor information
- Shows actual pricing and stock levels
- Supports browsing by category and region

## Database Schema Integration

The system now accesses these Market Connect tables:
- **products**: Product catalog with pricing, stock, and vendor info
- **vendors**: Verified vendor profiles with trust scores
- **categories**: Product categories with icons
- **orders**: Order management and tracking
- **order_items**: Detailed order line items

## Key Features

### Real Product Data
- Live product catalog from verified vendors
- Actual pricing in Tanzanian Shillings
- Stock level tracking
- Product grades (A, B, C) and descriptions

### Vendor Information
- Business names and contact details
- Market locations and regions
- Trust scores and verification status
- Direct vendor-customer connections

### Enhanced Shopping Experience
- Browse products by category or region
- Search functionality across all products
- Real-time stock availability
- Vendor-specific product listings

### Order Management
- Orders are created in the Market Connect database
- Automatic stock updates after purchases
- Order tracking with unique order numbers
- SMS notifications to both buyers and vendors

## Payment Configuration

The system supports two payment modes that can be easily switched:

### 🧪 **Sandbox Mode** (Default - Safe for Testing)
- **Simulated payments** - No real money is charged
- **Auto-confirmation** - Payments automatically succeed/fail after 3 seconds
- **Configurable success rate** - Default 90% success rate
- **Safe for development** - Perfect for testing and demos

### 💰 **Live Mode** (Production - Real Payments)
- **Real mobile money payments** - Actual money is charged
- **Integration required** - Needs live payment gateway configuration
- **Production ready** - For actual business operations
- **Requires credentials** - Live payment API keys needed

### Switching Payment Modes

#### Using NPM Scripts (Recommended):
```bash
# Switch to sandbox mode (safe testing)
npm run payment:sandbox

# Switch to live mode (real payments)
npm run payment:live

# Check current payment mode
npm run payment:status
```

#### Using the Switcher Script:
```bash
# Switch to sandbox mode
node switch-payment-mode.js sandbox

# Switch to live mode  
node switch-payment-mode.js live
```

### Environment Configuration

#### Sandbox Settings:
```env
PAYMENT_MODE=sandbox
SANDBOX_AUTO_CONFIRM_DELAY=3000    # Auto-confirm after 3 seconds
SANDBOX_SUCCESS_RATE=0.9           # 90% success rate
```

#### Live Settings:
```env
PAYMENT_MODE=live
LIVE_PAYMENT_GATEWAY_URL=https://api.payment-gateway.com
LIVE_PAYMENT_API_KEY=your_live_api_key
LIVE_PAYMENT_SECRET=your_live_secret
```

### Payment Gateway Integration

For live payments, you'll need to integrate with Tanzania's mobile money providers:

- **Vodacom M-Pesa** - Most popular mobile money service
- **Tigo Pesa** - Tigo's mobile money platform  
- **Airtel Money** - Airtel's mobile money service
- **CRDB Bank Mobile** - Bank-based mobile money
- **NMB Mobile Money** - NMB Bank's mobile service

The system is designed to work with any payment gateway that supports:
- PUSH payment requests (STK Push)
- Webhook callbacks for payment confirmation
- Standard REST API integration

### Safety Features

- **Mode validation** - System validates configuration on startup
- **Clear logging** - Payment mode is clearly logged in console
- **Error handling** - Graceful fallback if live payments aren't configured
- **Visual indicators** - SANDBOX payments are clearly marked in logs and messages

## Database Configuration

The integration uses these environment variables in `.env`:

```env
# Supabase Configuration (Market Connect Integration)
SUPABASE_URL=https://rfxpkuzizwlxfhabtnzg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Testing

Run the integration test to verify connectivity:

```bash
node test-integration.js
```

This will test:
- Database connectivity
- Product fetching
- Search functionality
- Cart operations
- Order creation

## Usage Examples

### SMS Commands (now with real data)
- `shop` - Browse actual marketplace products
- `search maize` - Find real maize products from vendors
- `add maize` - Add actual products to cart
- `cart` - View cart with real pricing
- `checkout` - Purchase from actual vendors

### USSD Menu (enhanced)
- Products now show vendor names and locations
- Pricing reflects actual market rates
- Stock levels are real-time
- Categories match actual product classifications

## Benefits

1. **Real Marketplace**: Customers shop from actual vendors
2. **Live Data**: Pricing and stock are always current
3. **Vendor Network**: Access to verified local vendors
4. **Trust System**: Vendor ratings and verification status
5. **Regional Focus**: Products filtered by location
6. **Complete Orders**: Full order lifecycle in database

## Future Enhancements

- Real-time inventory synchronization
- Vendor-specific promotions
- Advanced search filters (price range, location, ratings)
- Multi-vendor cart support
- Delivery tracking integration
- Vendor analytics and reporting

## Support

For technical issues with the integration:
1. Check database connectivity with the test script
2. Verify environment variables are set correctly
3. Ensure Supabase service is accessible
4. Review logs for specific error messages

The integration maintains backward compatibility while providing access to the full Market Connect ecosystem.