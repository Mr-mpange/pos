# Cart Management & AI Flow Features

## Overview
Enhanced the POS system with individual item removal capabilities and intelligent AI flow guidance to help users complete their shopping journey from browsing to payment.

## New Features

### 1. Individual Item Removal

#### Remove by Item Number
Users can now remove specific items from their cart using item numbers:
```
User: "cart"
Maya: "Your cart:
1. 2 loaf(s) Bread - 4,000 TZS
2. 1 liter(s) Milk - 3,000 TZS
3. 3 kg(s) Rice - 15,000 TZS

Total: 22,000 TZS
To remove an item, type 'remove [number]' (e.g., 'remove 1')"

User: "remove 2"
Maya: "Removed Milk from cart. Cart total: 19,000 TZS"
```

#### Remove by Item Name
Users can also remove items by name:
```
User: "remove bread"
Maya: "Removed Bread from cart. Cart total: 15,000 TZS"
```

#### Enhanced Cart Display
- Items are numbered for easy reference
- Clear instructions on how to remove items
- Better formatting for readability

### 2. AI System Flow Guidance

#### Session State Tracking
The AI now tracks user progress through different states:
- `WELCOME` - New user, needs introduction
- `BROWSING` - Looking at products
- `ADDING_ITEMS` - Adding products to cart
- `REVIEWING_CART` - Viewing cart contents
- `READY_TO_CHECKOUT` - Cart ready for purchase
- `PAYMENT_PENDING` - Waiting for payment confirmation
- `COMPLETED` - Transaction finished

#### Smart Next-Step Suggestions
The AI provides contextual guidance based on user's current state:

```
User: "shop"
Maya: "Here's what we have in stock today:
Bread - 2,000 TZS/loaf (Bakery Shop)
Milk - 3,000 TZS/liter (Dairy Farm)
...

💡 Next: Found something you like? Type 'add [item name]' to add it to your cart!"
```

```
User: "add bread"
Maya: "Added 1 loaf(s) of Bread to cart. Cart total: 2,000 TZS

💡 Great! You have 1 item(s) in your cart. Type 'cart' to review or keep shopping!"
```

#### Personalized Welcome for New Users
First-time users get a warm welcome with clear guidance:
```
User: "Hi"
Maya: "Hi! Welcome to Soko Connect! 🛒 I can help you shop from local vendors or manage your wallet. Try 'shop' to browse products or 'balance' to check your money!

💡 Next: Type 'shop' to browse products or 'search [item]' to find something specific!"
```

### 3. Enhanced Commands

#### New Help Command
```
User: "help"
Maya: "I can help you shop and manage payments! 🛒💰

Shopping commands:
• 'shop' - Browse products
• 'search [item]' - Find specific items
• 'add [item]' - Add to cart
• 'cart' - View your cart
• 'remove [number]' - Remove item by number
• 'checkout' - Complete purchase
• 'clear' - Empty cart

Payment commands:
• 'balance' - Check your money
• 'send [amount] to [number]' - Transfer money
• 'history' - View transactions

Just text me naturally and I'll help guide you through everything!"
```

#### Improved Error Handling
Better error messages for invalid operations:
```
User: "remove 10"
Maya: "Invalid item number. Please choose between 1 and 3"

User: "remove pizza"
Maya: "I couldn't find 'pizza' in your cart. Type 'cart' to see what you have."
```

## Technical Implementation

### New POS Service Methods

#### `removeFromCartByIndex(phoneNumber, itemIndex)`
- Removes item by 1-based index
- Returns detailed success/error messages
- Updates cart total automatically

#### `getFormattedCart(phoneNumber)`
- Returns cart with numbered items
- Includes removal instructions
- Better formatting for SMS display

### AI Service Enhancements

#### Session Management
- `getUserSession(phoneNumber)` - Get user's current session state
- `updateUserSession(phoneNumber, updates)` - Update session data
- `getNextStepGuidance(phoneNumber, currentAction)` - Generate contextual suggestions

#### Enhanced Command Parsing
- Support for `remove [number]` and `remove [name]` patterns
- Help command recognition
- Better natural language understanding

#### Flow-Aware Responses
- Context-sensitive replies based on user's journey stage
- Proactive guidance suggestions
- Personalized messaging for new vs returning users

## Usage Examples

### Complete Shopping Flow
```
1. User: "Hi"
   Maya: Welcome message + guidance to start shopping

2. User: "shop"
   Maya: Product list + guidance to add items

3. User: "add bread"
   Maya: Confirmation + guidance to review cart or continue

4. User: "add milk"
   Maya: Confirmation + updated guidance

5. User: "cart"
   Maya: Numbered cart items + removal instructions + checkout guidance

6. User: "remove 1"
   Maya: Item removed + updated total

7. User: "checkout"
   Maya: Payment initiation + guidance to check phone

8. Payment confirmed via webhook
   Maya: Success message + session reset for next shopping
```

### Error Recovery
```
User: "remove 5"
Maya: "Invalid item number. Please choose between 1 and 2"

User: "cart"
Maya: Shows current cart with proper numbering

User: "remove 1"
Maya: Successfully removes item
```

## Benefits

1. **Better User Experience**: Clear guidance through the entire shopping process
2. **Reduced Confusion**: Numbered items make removal intuitive
3. **Higher Completion Rates**: Proactive guidance helps users complete purchases
4. **Error Prevention**: Better validation and helpful error messages
5. **Natural Interaction**: AI understands context and provides relevant suggestions

## Testing

Run the test script to verify functionality:
```bash
node test-cart-management.js
```

This will test:
- Welcome flow for new users
- Item addition with guidance
- Cart viewing with numbering
- Item removal by index and name
- Error handling for invalid operations
- Help command functionality
- Flow guidance at each step