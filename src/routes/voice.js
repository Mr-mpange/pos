const express = require('express');
const at = require('../config/at');
const axios = require('axios');

const router = express.Router();
const voice = at.VOICE;

// POST /voice/call - initiate a call from AT number to a recipient
router.post('/call', async (req, res) => {
  try {
    // Allow defaults from .env for convenience
    const envFrom = process.env.AT_VOICE_PHONE_NUMBER;
    const envTo = process.env.DEFAULT_RECIPIENT;
    const bodyFrom = req.body && req.body.callFrom;
    const bodyTo = req.body && req.body.callTo;
    const callFrom = bodyFrom || envFrom; // must be your AT voice number
    const callTo = bodyTo || envTo;       // destination/callee

    if (!callFrom || !callTo) {
      return res.status(400).json({ error: 'callFrom and callTo are required (provide in body or set AT_VOICE_PHONE_NUMBER and DEFAULT_RECIPIENT in .env)' });
    }

    // First try SDK
    try {
      const result = await voice.call({ callFrom, callTo });
      return res.json({ ok: true, via: 'sdk', used: { callFrom, callTo }, result });
    } catch (sdkErr) {
      console.warn('[Voice] SDK call failed, attempting REST fallback:', sdkErr.message);
      // REST fallback
      const { AT_USERNAME, AT_API_KEY } = process.env;
      if (!AT_USERNAME || !AT_API_KEY) {
        return res.status(500).json({ error: 'AT credentials missing for REST fallback' });
      }
      // Build form data
      const form = new URLSearchParams();
      form.append('username', AT_USERNAME);
      form.append('from', callFrom);
      form.append('to', callTo);

      // POST to AT Voice REST endpoint
      const voiceUrl = 'https://voice.africastalking.com/call';
      const response = await axios.post(
        voiceUrl,
        form.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            apikey: AT_API_KEY,
          },
          timeout: 15000,
        }
      );

      return res.json({ ok: true, via: 'rest', used: { callFrom, callTo }, data: response.data });
    }
  } catch (err) {
    console.error('Voice call error', err);
    return res.status(500).json({ error: 'Failed to initiate call', details: err.message });
  }
});
// Voice events callback
router.post('/events', (req, res) => {
  console.log('[Voice Events]', req.body);
  // Must return 200 OK fast
  res.status(200).send('OK');
});

// Convenience GET for events (browser test)
router.get('/events', (req, res) => {
  console.log('[Voice Events][GET]', req.query);
  res.status(200).send('OK');
});

function buildMenuXml(selfUrl, lang = 'en') {
  const prompts = {
    en: {
      intro: 'Main menu. Please choose an option.',
      options: 'Press 1 to ask anything. Press 2 for company information. Press 3 to speak to an agent. Press 4 to repeat this menu. Press 5 to end the call.',
      noInput: 'No input received. Repeating the menu.'
    },
    sw: {
      intro: 'Menyu kuu. Tafadhali chagua chaguo.',
      options: 'Bonyeza 1 kuuliza chochote. Bonyeza 2 kupata taarifa za kampuni. Bonyeza 3 kuzungumza na wakala. Bonyeza 4 kurudia menyu hii. Bonyeza 5 kukata simu.',
      noInput: 'Hakuna ingizo. Kurudia menyu.'
    }
  };
  const p = prompts[lang] || prompts.en;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${p.intro}</Say>
  <GetDigits timeout="20" numDigits="1" callbackUrl="${selfUrl}">
    <Say>${p.options}</Say>
  </GetDigits>
  <Say>${p.noInput}</Say>
  <Redirect>${selfUrl.replace('/digits', '/actions')}</Redirect>
</Response>`;
}

function handleSelectionXml(digits, lang = 'en') {
  const msg = (en, sw) => (lang === 'sw' ? sw : en);
  if (digits === '1') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg('Thanks for calling. Ask your question via SMS and we will respond. Goodbye.', 'Asante kwa kupiga simu. Uliza swali lako kwa SMS na tutajibu. Kwaheri.')}</Say>
  <Hangup/>
</Response>`;
  }
  if (digits === '2') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg('Our company offers digital solutions and support. Operating hours: Monday to Friday, 8 A M to 6 P M E A T. Goodbye.', 'Kampuni yetu hutoa huduma za kidijitali na usaidizi. Saa za kazi: Jumatatu hadi Ijumaa, saa 2 asubuhi hadi saa 12 jioni E A T. Kwaheri.')}</Say>
  <Hangup/>
</Response>`;
  }
  if (digits === '3') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg('All agents are busy. Please try again later or send us an SMS. Goodbye.', 'Wakala wote wana hudumia wengine. Jaribu tena baadaye au tuma SMS. Kwaheri.')}</Say>
  <Hangup/>
</Response>`;
  }
  if (digits === '4') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>/voice/actions</Redirect>
</Response>`;
  }
  if (digits === '5') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg('Thank you. Ending the call now. Goodbye.', 'Asante. Tunakata simu sasa. Kwaheri.')}</Say>
  <Hangup/>
</Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg('Invalid choice. Goodbye.', 'Chaguo batili. Kwaheri.')}</Say>
  <Hangup/>
</Response>`;
}

// Voice actions – Language selection then IVR menu
router.post('/actions', (req, res) => {
  console.log('[Voice Actions]', req.body);
  res.set('Content-Type', 'application/xml');
  const isActive = req.body && String(req.body.isActive);
  const digits = (req.body && (req.body.dtmfDigits || req.body.digits)) || '';

  // If call is not active, AT is posting a call summary (duration, status, etc.). No IVR needed.
  if (isActive === '0') {
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
  if (!digits) {
    // Language selection (1 English, 2 Swahili)
    const host = req.get('host');
    const baseUrl = `https://${host}`;
    const langUrl = `${baseUrl}${req.baseUrl}/lang`;
    console.log('[Voice Actions] Using language callbackUrl:', langUrl);
    if (isActive === '1') {
      console.log('[Voice Actions][FIRST-HIT] Active call, serving language selection');
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Choose language. Press 1 for English. Press 2 for Swahili.</Say>
  <GetDigits timeout="20" numDigits="1" callbackUrl="${langUrl}">
    <Say>Press 1 for English. Press 2 for Swahili.</Say>
  </GetDigits>
  <Say>No input received. Returning to language selection.</Say>
  <Redirect>${baseUrl}/voice/actions</Redirect>
</Response>`;
    return res.send(xml);
  }
  // Rare case AT posts digits here; default to English
  return res.send(handleSelectionXml(digits, 'en'));
});

// Convenience GET for actions (browser test)
router.get('/actions', (req, res) => {
  console.log('[Voice Actions][GET]', req.query);
  res.set('Content-Type', 'application/xml');
  const digits = req.query && (req.query.dtmfDigits || req.query.digits);
  if (!digits) {
    const host = req.get('host');
    const baseUrl = `https://${host}`;
    const langUrl = `${baseUrl}${req.baseUrl}/lang`;
    console.log('[Voice Actions][GET] Using language callbackUrl:', langUrl);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Choose language. Press 1 for English. Press 2 for Swahili.</Say>
  <GetDigits timeout="20" numDigits="1" callbackUrl="${langUrl}">
    <Say>Press 1 for English. Press 2 for Swahili.</Say>
  </GetDigits>
  <Say>No input received. Returning to language selection.</Say>
  <Redirect>/voice/actions</Redirect>
</Response>`;
    return res.send(xml);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>You entered ${digits}. Goodbye.</Say>
  <Hangup/>
</Response>`;
  return res.send(xml);
});

// Dedicated handler for DTMF callbacks from <GetDigits>
router.post('/digits', (req, res) => {
  console.log('[Voice Digits][POST]', req.body);
  res.set('Content-Type', 'application/xml');
  const digits = (req.body && (req.body.dtmfDigits || req.body.digits)) || '';
  const lang = (req.query && req.query.lang) || 'en';
  return res.send(handleSelectionXml(digits, lang));
});

router.get('/digits', (req, res) => {
  console.log('[Voice Digits][GET]', req.query);
  res.set('Content-Type', 'application/xml');
  const digits = (req.query && (req.query.dtmfDigits || req.query.digits)) || '';
  const lang = (req.query && req.query.lang) || 'en';
  return res.send(handleSelectionXml(digits || '5', lang));
});

// Language selection callback
router.post('/lang', (req, res) => {
  console.log('[Voice Lang][POST]', req.body);
  res.set('Content-Type', 'application/xml');
  const digit = (req.body && (req.body.dtmfDigits || req.body.digits)) || '';
  const host = req.get('host');
  const baseUrl = `https://${host}`;
  const lang = digit === '2' ? 'sw' : 'en';
  const digitsUrl = `${baseUrl}${req.baseUrl}/digits?lang=${lang}`;
  return res.send(buildMenuXml(digitsUrl, lang));
});

router.get('/lang', (req, res) => {
  console.log('[Voice Lang][GET]', req.query);
  res.set('Content-Type', 'application/xml');
  const host = req.get('host');
  const baseUrl = `https://${host}`;
  const lang = (req.query && req.query.lang) === 'sw' ? 'sw' : 'en';
  const digitsUrl = `${baseUrl}${req.baseUrl}/digits?lang=${lang}`;
  return res.send(buildMenuXml(digitsUrl, lang));
});

// Voice shopping actions with language support
router.post('/shop', (req, res) => {
  console.log('[Voice Shop]', req.body);
  res.set('Content-Type', 'application/xml');
  
  const isActive = req.body && String(req.body.isActive);
  const digits = (req.body && (req.body.dtmfDigits || req.body.digits)) || '';
  const phoneNumber = req.body && req.body.callerNumber;
  const lang = (req.query && req.query.lang) || 'en';

  // If call is not active, return empty response
  if (isActive === '0') {
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }

  const host = req.get('host');
  const baseUrl = `https://${host}`;
  const shopUrl = `${baseUrl}${req.baseUrl}/shop?lang=${lang}`;

  // Language-specific messages
  const messages = {
    en: {
      welcome: 'Welcome to Voice Shopping! Press 1 for Coca Cola 1500 shillings. Press 2 for Bread 2000 shillings. Press 3 for Milk 3000 shillings. Press 4 for Rice 8000 shillings. Press 5 to checkout. Press 0 to end call.',
      options: 'Press 1 for Coca Cola. Press 2 for Bread. Press 3 for Milk. Press 4 for Rice. Press 5 to checkout. Press 0 to end.',
      added: (item) => `Added ${item} to cart. Press 1 for Coca Cola. Press 2 for Bread. Press 3 for Milk. Press 4 for Rice. Press 5 to checkout. Press 0 to end.`,
      moreAdded: (item) => `Added ${item} to cart. Press 1 for more Coca Cola. Press 2 for Bread. Press 3 for Milk. Press 4 for Rice. Press 5 to checkout. Press 0 to end.`,
      emptyCart: 'Your cart is empty. Please add items first. Ending call.',
      checkout: (total) => `Processing your order of ${total} shillings. You will receive payment confirmation shortly. Thank you for shopping with us!`,
      goodbye: 'Thank you for calling. Your items remain in cart for USSD checkout. Goodbye!',
      invalid: 'Invalid selection. Press 1 for Coca Cola. Press 2 for Bread. Press 3 for Milk. Press 4 for Rice. Press 5 to checkout. Press 0 to end.',
      noInput: 'No input received. Ending call.',
      choicePrompt: 'Press your choice or 5 to checkout.'
    },
    sw: {
      welcome: 'Karibu kwenye Ununuzi wa Sauti! Bonyeza 1 kwa Coca Cola shilingi 1500. Bonyeza 2 kwa Mkate shilingi 2000. Bonyeza 3 kwa Maziwa shilingi 3000. Bonyeza 4 kwa Mchele shilingi 8000. Bonyeza 5 kulipa. Bonyeza 0 kumaliza.',
      options: 'Bonyeza 1 kwa Coca Cola. Bonyeza 2 kwa Mkate. Bonyeza 3 kwa Maziwa. Bonyeza 4 kwa Mchele. Bonyeza 5 kulipa. Bonyeza 0 kumaliza.',
      added: (item) => `Imeongezwa ${item} kwenye kikapu. Bonyeza 1 kwa Coca Cola. Bonyeza 2 kwa Mkate. Bonyeza 3 kwa Maziwa. Bonyeza 4 kwa Mchele. Bonyeza 5 kulipa. Bonyeza 0 kumaliza.`,
      moreAdded: (item) => `Imeongezwa ${item} kwenye kikapu. Bonyeza 1 kwa Coca Cola zaidi. Bonyeza 2 kwa Mkate. Bonyeza 3 kwa Maziwa. Bonyeza 4 kwa Mchele. Bonyeza 5 kulipa. Bonyeza 0 kumaliza.`,
      emptyCart: 'Kikapu chako ni tupu. Tafadhali ongeza bidhaa kwanza. Kumaliza simu.',
      checkout: (total) => `Kuchakata agizo lako la shilingi ${total}. Utapokea uthibitisho wa malipo hivi karibuni. Asante kwa ununuzi!`,
      goodbye: 'Asante kwa kupiga simu. Bidhaa zako zimebaki kwenye kikapu kwa malipo ya USSD. Kwaheri!',
      invalid: 'Chaguo batili. Bonyeza 1 kwa Coca Cola. Bonyeza 2 kwa Mkate. Bonyeza 3 kwa Maziwa. Bonyeza 4 kwa Mchele. Bonyeza 5 kulipa. Bonyeza 0 kumaliza.',
      noInput: 'Hakuna ingizo. Kumaliza simu.',
      choicePrompt: 'Bonyeza chaguo lako au 5 kulipa.'
    }
  };

  const msg = messages[lang] || messages.en;

  if (!digits) {
    // First time - show shopping menu
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg.welcome}</Say>
  <GetDigits timeout="30" numDigits="1" callbackUrl="${shopUrl}">
    <Say>${msg.options}</Say>
  </GetDigits>
  <Say>${msg.noInput}</Say>
  <Hangup/>
</Response>`;
    return res.send(xml);
  }

  // Handle product selection
  const POSService = require('../services/pos');
  const productNames = {
    en: { '001': 'Coca Cola', '002': 'Bread', '003': 'Milk', '004': 'Rice' },
    sw: { '001': 'Coca Cola', '002': 'Mkate', '003': 'Maziwa', '004': 'Mchele' }
  };

  if (digits === '1') {
    // Add Coca Cola
    POSService.addToCart(phoneNumber, '001', 1);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg.moreAdded(productNames[lang]['001'])}</Say>
  <GetDigits timeout="30" numDigits="1" callbackUrl="${shopUrl}">
    <Say>${msg.choicePrompt}</Say>
  </GetDigits>
  <Say>${msg.noInput}</Say>
  <Hangup/>
</Response>`;
    return res.send(xml);
  }

  if (digits === '2') {
    // Add Bread
    POSService.addToCart(phoneNumber, '002', 1);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg.added(productNames[lang]['002'])}</Say>
  <GetDigits timeout="30" numDigits="1" callbackUrl="${shopUrl}">
    <Say>${msg.choicePrompt}</Say>
  </GetDigits>
  <Say>${msg.noInput}</Say>
  <Hangup/>
</Response>`;
    return res.send(xml);
  }

  if (digits === '3') {
    // Add Milk
    POSService.addToCart(phoneNumber, '003', 1);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg.added(productNames[lang]['003'])}</Say>
  <GetDigits timeout="30" numDigits="1" callbackUrl="${shopUrl}">
    <Say>${msg.choicePrompt}</Say>
  </GetDigits>
  <Say>${msg.noInput}</Say>
  <Hangup/>
</Response>`;
    return res.send(xml);
  }

  if (digits === '4') {
    // Add Rice
    POSService.addToCart(phoneNumber, '004', 1);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg.added(productNames[lang]['004'])}</Say>
  <GetDigits timeout="30" numDigits="1" callbackUrl="${shopUrl}">
    <Say>${msg.choicePrompt}</Say>
  </GetDigits>
  <Say>${msg.noInput}</Say>
  <Hangup/>
</Response>`;
    return res.send(xml);
  }

  if (digits === '5') {
    // Checkout
    const cart = POSService.getCart(phoneNumber);
    if (cart.items.length === 0) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg.emptyCart}</Say>
  <Hangup/>
</Response>`;
      return res.send(xml);
    }

    // Process checkout
    POSService.processCheckout(phoneNumber).then(result => {
      console.log('[Voice Shop] Checkout result:', result);
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg.checkout(cart.total)}</Say>
  <Hangup/>
</Response>`;
    return res.send(xml);
  }

  if (digits === '0') {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg.goodbye}</Say>
  <Hangup/>
</Response>`;
    return res.send(xml);
  }

  // Invalid selection
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${msg.invalid}</Say>
  <GetDigits timeout="30" numDigits="1" callbackUrl="${shopUrl}">
    <Say>${msg.choicePrompt}</Say>
  </GetDigits>
  <Say>${msg.noInput}</Say>
  <Hangup/>
</Response>`;
  return res.send(xml);
});

// Language selection for shopping
router.post('/shop-lang', (req, res) => {
  console.log('[Voice Shop Lang]', req.body);
  res.set('Content-Type', 'application/xml');
  
  const isActive = req.body && String(req.body.isActive);
  const digit = (req.body && (req.body.dtmfDigits || req.body.digits)) || '';
  
  // If call is not active, return empty response
  if (isActive === '0') {
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
  
  const host = req.get('host');
  const baseUrl = `https://${host}`;
  
  if (!digit) {
    // First time - show language selection
    const shopLangUrl = `${baseUrl}${req.baseUrl}/shop-lang`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Choose language for shopping. Press 1 for English. Press 2 for Swahili. Chagua lugha ya ununuzi. Bonyeza 1 kwa Kiingereza. Bonyeza 2 kwa Kiswahili.</Say>
  <GetDigits timeout="20" numDigits="1" callbackUrl="${shopLangUrl}">
    <Say>Press 1 for English. Press 2 for Swahili.</Say>
  </GetDigits>
  <Say>No language selected. Ending call.</Say>
  <Hangup/>
</Response>`;
    return res.send(xml);
  }
  
  // Redirect to shopping with selected language
  const lang = digit === '2' ? 'sw' : 'en';
  const shopUrl = `${baseUrl}${req.baseUrl}/shop?lang=${lang}`;
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${shopUrl}</Redirect>
</Response>`;
  return res.send(xml);
});

module.exports = router;
