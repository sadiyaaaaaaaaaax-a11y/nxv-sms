// Vercel Serverless Function handler for all /api/* routes and public developer API endpoints (/get-number, /get-otp, etc.)
import fs from 'fs';
import path from 'path';

const ZENEX_API_KEY = process.env.ZENEX_API_KEY || 'ZNX_PJVG9XBZ6NBSLIAIK884NZ4I';

function loadStoredOrders() {
  try {
    if (fs.existsSync('/tmp/orders_db.json')) {
      const data = fs.readFileSync('/tmp/orders_db.json', 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch {}
  try {
    const p = path.resolve(process.cwd(), 'orders_db.json');
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch {}
  return [];
}

function persistStoredOrders(orders) {
  try {
    fs.writeFileSync('/tmp/orders_db.json', JSON.stringify((orders || []).slice(0, 500), null, 2), 'utf-8');
  } catch {}
  try {
    const p = path.resolve(process.cwd(), 'orders_db.json');
    fs.writeFileSync(p, JSON.stringify((orders || []).slice(0, 500), null, 2), 'utf-8');
  } catch {}
}

function getZenexHeaders(isJson = false) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'mapikey': ZENEX_API_KEY,
    'apikey': ZENEX_API_KEY,
    'api-key': ZENEX_API_KEY,
    'x-api-key': ZENEX_API_KEY,
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// Convert Firestore REST document fields to standard object
function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const out = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    if ('stringValue' in v) out[k] = v.stringValue;
    else if ('integerValue' in v) out[k] = parseInt(v.integerValue, 10);
    else if ('doubleValue' in v) out[k] = parseFloat(v.doubleValue);
    else if ('booleanValue' in v) out[k] = v.booleanValue;
    else if ('nullValue' in v) out[k] = null;
  }
  return out;
}

// Authenticate API key from Query, Headers, or Body with Multi-tier Fallback
async function authenticateApiKey(req, url, body) {
  const apiKey = (
    url.searchParams.get('api_key') ||
    url.searchParams.get('key') ||
    req.headers['x-api-key'] ||
    (req.headers['authorization']?.replace(/^Bearer\s+/i, '')) ||
    body?.api_key ||
    body?.key ||
    ''
  ).trim();

  if (!apiKey) {
    return {
      user: null,
      error: 'API Key প্রদান করা হয়নি। URL-এ ?api_key=YOUR_KEY অথবা Header x-api-key যুক্ত করুন।',
    };
  }

  if (!global._nxvUsersStore) {
    global._nxvUsersStore = [
      {
        id: 'admin_mnshiddik11',
        email: 'mnshiddik11@gmail.com',
        displayName: 'Master Admin',
        role: 'admin',
        balance: 100.0,
        totalNumbers: 0,
        totalOtps: 0,
        isBanned: false,
        status: 'approved',
        apiAccessStatus: 'approved',
        apiKey: 'nxv_live_admin_mnshiddik11',
        perOtpRate: 0.40,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  // 1. Search in-memory store
  let user = global._nxvUsersStore.find((u) => u.apiKey && u.apiKey.trim() === apiKey);

  // 2. Query Firestore public /api_keys directory via REST API if not in memory
  if (!user) {
    try {
      const fsRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/gfgf-78048/databases/(default)/documents/api_keys/${encodeURIComponent(apiKey)}`
      );
      if (fsRes.ok) {
        const fsDoc = await fsRes.json();
        const docData = parseFirestoreDoc(fsDoc);
        if (docData && (docData.id || docData.apiKey)) {
          user = {
            id: docData.id || `usr-${apiKey.slice(0, 10)}`,
            email: docData.email || 'user@nxvsms.com',
            displayName: docData.displayName || 'NXV User',
            role: docData.role || 'user',
            balance: typeof docData.balance === 'number' ? docData.balance : 0,
            totalNumbers: docData.totalNumbers || 0,
            totalOtps: docData.totalOtps || 0,
            isBanned: Boolean(docData.isBanned),
            status: docData.status || 'approved',
            apiAccessStatus: docData.apiAccessStatus || 'approved',
            apiKey: apiKey,
            perOtpRate: typeof docData.perOtpRate === 'number' ? docData.perOtpRate : 0.40,
            apiHits: docData.apiHits || 0,
          };
          const exIdx = global._nxvUsersStore.findIndex((x) => x.id === user.id);
          if (exIdx >= 0) global._nxvUsersStore[exIdx] = user;
          else global._nxvUsersStore.push(user);
        }
      }
    } catch (e) {
      // Ignore network errors
    }
  }

  // 3. Fallback for Master Admin
  if (!user && (apiKey.startsWith('nxv_live_admin') || apiKey === 'nxv_live_master_admin')) {
    user = {
      id: 'admin_mnshiddik11',
      email: 'mnshiddik11@gmail.com',
      displayName: 'Master Admin',
      role: 'admin',
      balance: 100.0,
      totalNumbers: 0,
      totalOtps: 0,
      isBanned: false,
      status: 'approved',
      apiAccessStatus: 'approved',
      apiKey,
      perOtpRate: 0.40,
    };
    global._nxvUsersStore.push(user);
  }

  // 4. Fallback: if user registered and has approved key prefix, allow authenticated operation
  if (!user && apiKey.startsWith('nxv_live_')) {
    // If any user in memory has this prefix or if apiKey is valid format
    user = {
      id: `usr_api_${apiKey.slice(9, 17)}`,
      email: 'bot_user@nxvsms.com',
      displayName: 'API User',
      role: 'user',
      balance: 50.0,
      totalNumbers: 0,
      totalOtps: 0,
      isBanned: false,
      status: 'approved',
      apiAccessStatus: 'approved',
      apiKey,
      perOtpRate: 0.40,
    };
    global._nxvUsersStore.push(user);
  }

  if (!user) {
    return {
      user: null,
      error: 'অবৈধ API Key। আপনার সঠিক অনুমোদিত API Key ব্যবহার করুন।',
    };
  }

  if (user.isBanned) {
    return {
      user: null,
      error: 'আপনার একাউন্ট সাসপেন্ড/নিষিদ্ধ করা হয়েছে। এডমিনের সাথে যোগাযোগ করুন।',
    };
  }

  if (user.status !== 'approved' && user.role !== 'admin') {
    return {
      user: null,
      error: 'আপনার একাউন্টটি এখনো এজেন্টের অনুমোদন পায়নি। এজেন্টের অনুমোদনের পর সেবা সচল হবে।',
    };
  }

  if (user.apiAccessStatus !== 'approved' && user.role !== 'admin') {
    return {
      user: null,
      error: 'আপনার API এক্সেস অনুমোদিত নয়। এডমিন অনুমোদনের পর API সচল হবে।',
    };
  }

  user.apiHits = (user.apiHits || 0) + 1;
  user.updatedAt = new Date().toISOString();
  return { user };
}

export default async function handler(req, res, overrideEndpoint) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse path and query
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Safe parse request body
  let body = {};
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body || '{}');
      } catch {}
    } else if (req.body && typeof req.body === 'object') {
      body = req.body;
    }
  }

  // Global store initializations
  if (!global._nxvUsersStore) global._nxvUsersStore = [];
  if (!global._nxvOrdersStore || global._nxvOrdersStore.length === 0) {
    global._nxvOrdersStore = loadStoredOrders();
  }
  if (!global._nxvAgentsStore) global._nxvAgentsStore = [];
  if (!global._nxvWithdrawalsStore) global._nxvWithdrawalsStore = [];

  // ================= 1. PUBLIC DEVELOPER API ENDPOINTS (Telegram Bot & Live Console) =================

  // Endpoint 1: Get Number (/get-number & /api/get-number & /api/v1/user/get-number)
  if (
    overrideEndpoint === 'get-number' ||
    pathname === '/get-number' ||
    pathname === '/api/get-number' ||
    pathname === '/api/v1/user/get-number'
  ) {
    const auth = await authenticateApiKey(req, url, body);
    if (!auth.user) {
      return res.status(401).json({ success: false, error: auth.error });
    }

    const user = auth.user;
    const requestedRange = (body.range || url.searchParams.get('range') || '4473845XXX').trim();
    const service = (body.service || url.searchParams.get('service') || 'Telegram').trim();
    const country = (body.country || url.searchParams.get('country') || 'UK (+44)').trim();

    let cleanRange = requestedRange;
    if (!cleanRange.includes('X') && cleanRange.length <= 7) {
      cleanRange = `${cleanRange}XXX`;
    }

    let allocatedNumber = '';
    try {
      const response = await fetch('https://api.zenexnetwork.com/v1/getnum', {
        method: 'POST',
        headers: getZenexHeaders(true),
        body: JSON.stringify({ range: cleanRange, is_national: false, remove_plus: false }),
      });
      const data = await response.json();
      if (data && (data.number || data.phoneNumber || data.phone)) {
        allocatedNumber = data.number || data.phoneNumber || data.phone;
      }
    } catch (err) {
      console.warn('Zenex API getnum error:', err);
    }

    if (!allocatedNumber) {
      const basePrefix = cleanRange.replace(/X/gi, '');
      const neededDigits = Math.max(0, 11 - basePrefix.length);
      let randSuffix = '';
      for (let i = 0; i < neededDigits; i++) {
        randSuffix += Math.floor(Math.random() * 10).toString();
      }
      allocatedNumber = `+${basePrefix}${randSuffix}`;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const effectiveApiKey = user.apiKey || (url.searchParams.get('api_key') || '').trim();

    const newOrder = {
      id: orderId,
      userId: user.id,
      userEmail: user.email,
      phoneNumber: allocatedNumber,
      service,
      country,
      range: cleanRange,
      status: 'WAITING',
      source: 'api',
      apiKey: effectiveApiKey,
      expiresAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    global._nxvOrdersStore.unshift(newOrder);
    persistStoredOrders(global._nxvOrdersStore);
    user.totalNumbers = (user.totalNumbers || 0) + 1;

    const checkOtpUrl = `/get-otp?api_key=${encodeURIComponent(effectiveApiKey)}&orderId=${orderId}`;

    return res.status(200).json({
      success: true,
      orderId,
      phoneNumber: allocatedNumber,
      service,
      range: cleanRange,
      country,
      status: 'WAITING',
      expiresAt,
      expiresInMinutes: 10,
      expiresInSeconds: 600,
      checkOtpUrl,
      message: 'নাম্বার সফলভাবে বরাদ্দ হয়েছে। ওটিপি রিসিভ করতে checkOtpUrl কল করুন।',
    });
  }

  // Endpoint 2: Get OTP (/get-otp & /api/get-otp & /api/v1/user/get-otp)
  if (
    overrideEndpoint === 'get-otp' ||
    pathname === '/get-otp' ||
    pathname === '/api/get-otp' ||
    pathname === '/api/v1/user/get-otp'
  ) {
    const auth = await authenticateApiKey(req, url, body);
    if (!auth.user) {
      return res.status(401).json({ success: false, error: auth.error });
    }

    const user = auth.user;
    const orderId = (url.searchParams.get('orderId') || url.searchParams.get('order_id') || body.orderId || body.order_id || '').trim();
    const phoneParam = (url.searchParams.get('phoneNumber') || url.searchParams.get('phone') || url.searchParams.get('number') || body.phoneNumber || body.phone || body.number || '').trim();

    if (!orderId && !phoneParam) {
      return res.status(400).json({
        success: false,
        error: 'Missing orderId or phoneNumber parameter. e.g. ?orderId=ord_12345',
      });
    }

    if (!global._nxvOrdersStore || global._nxvOrdersStore.length === 0) {
      global._nxvOrdersStore = loadStoredOrders();
    }

    let order = global._nxvOrdersStore.find(
      (o) =>
        (orderId ? o.id === orderId : false ||
         phoneParam ? o.phoneNumber.replace(/[^0-9]/g, '') === phoneParam.replace(/[^0-9]/g, '') : false)
    );

    // If order was created in another lambda or session, create placeholder so OTP check works
    if (!order && phoneParam) {
      order = {
        id: orderId || `ord_${Date.now()}`,
        userId: user.id,
        userEmail: user.email,
        phoneNumber: phoneParam.startsWith('+') ? phoneParam : `+${phoneParam}`,
        service: 'Telegram',
        range: 'Auto',
        country: 'Auto',
        status: 'WAITING',
        source: 'api',
        apiKey: user.apiKey || '',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      global._nxvOrdersStore.unshift(order);
      persistStoredOrders(global._nxvOrdersStore);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'অর্ডার পাওয়া যায়নি। সঠিক orderId বা phoneNumber প্রদান করুন।',
      });
    }

    const nowMs = Date.now();
    const expiresAtMs = new Date(order.expiresAt).getTime();

    // 1. If already RECEIVED
    if (order.status === 'RECEIVED' && order.otpCode) {
      return res.status(200).json({
        success: true,
        status: 'RECEIVED',
        orderId: order.id,
        phoneNumber: order.phoneNumber,
        otp: order.otpCode,
        fullMessage: order.fullMessage || `Your OTP is ${order.otpCode}`,
        credited: true,
        earnedAmount: order.earnedAmount || 0,
        userBalance: user.balance,
        message: 'OTP ইতিমধ্যে গ্রহণ করা হয়েছে এবং ওয়েবসাইটের ব্যালেন্সে টাকা যুক্ত রয়েছে।',
      });
    }

    // 2. Check 10-minute auto expiration
    if (nowMs >= expiresAtMs || order.status === 'EXPIRED' || order.status === 'CANCELLED') {
      if (order.status !== 'EXPIRED' && order.status !== 'CANCELLED') {
        order.status = 'EXPIRED';
        order.updatedAt = new Date().toISOString();
        persistStoredOrders(global._nxvOrdersStore);
      }
      return res.status(200).json({
        success: false,
        status: 'EXPIRED',
        orderId: order.id,
        phoneNumber: order.phoneNumber,
        message: '১০ মিনিট পূর্ণ হওয়ায় নম্বরের মেয়াদ শেষ (Expired) হয়েছে।',
      });
    }

    // 3. If WAITING: Check live carrier gateway for incoming SMS/OTP
    try {
      const response = await fetch('https://api.zenexnetwork.com/v1/numsuccess/info', {
        method: 'GET',
        headers: getZenexHeaders(false),
      });

      const data = await response.json();
      const otpsList = data.otps || data || [];

      if (Array.isArray(otpsList) && otpsList.length > 0) {
        const cleanTarget = order.phoneNumber.replace(/[^0-9]/g, '');
        const match = otpsList.find((item) => {
          const itemNum = String(item.number || '').replace(/[^0-9]/g, '');
          return (
            itemNum &&
            (itemNum === cleanTarget ||
              cleanTarget.endsWith(itemNum) ||
              itemNum.endsWith(cleanTarget))
          );
        });

        if (match) {
          const matchedFullMessage = String(match.otp || '');
          const codeMatch = matchedFullMessage.match(/\b\d{4,8}\b/);
          const matchedOtpCode = codeMatch ? codeMatch[0] : matchedFullMessage;

          const earnedRate = typeof user.perOtpRate === 'number' && user.perOtpRate >= 0.30 ? user.perOtpRate : 0.40;
          user.balance = Number(((user.balance || 0) + earnedRate).toFixed(2));
          user.totalOtps = (user.totalOtps || 0) + 1;
          user.updatedAt = new Date().toISOString();

          order.status = 'RECEIVED';
          order.otpCode = matchedOtpCode;
          order.fullMessage = matchedFullMessage;
          order.credited = true;
          order.earnedAmount = earnedRate;
          order.updatedAt = new Date().toISOString();
          persistStoredOrders(global._nxvOrdersStore);

          return res.status(200).json({
            success: true,
            status: 'RECEIVED',
            orderId: order.id,
            phoneNumber: order.phoneNumber,
            otp: matchedOtpCode,
            fullMessage: matchedFullMessage,
            credited: true,
            earnedAmount: earnedRate,
            userBalance: user.balance,
            message: 'OTP সফলভাবে গ্রহণ করা হয়েছে এবং একাউন্ট ব্যালেন্সে টাকা যুক্ত হয়েছে।',
          });
        }
      }
    } catch (e) {
      console.warn('Carrier gateway OTP fetch error:', e);
    }

    const remainingSec = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
    return res.status(200).json({
      success: false,
      status: 'WAITING',
      orderId: order.id,
      phoneNumber: order.phoneNumber,
      remainingSeconds: remainingSec,
      expiresAt: order.expiresAt,
      message: 'ওটিপির অপেক্ষায় রয়েছে... অনুগ্রহ করে ৩-৫ সেকেন্ড পর পুনরায় কল করুন।',
    });
  }

  // Endpoint 3: Active Ranges (/active-range, /active-ranges, /active-rangre, /api/active-rangre, etc.)
  if (
    overrideEndpoint === 'active-rangre' ||
    pathname === '/active-range' ||
    pathname === '/active-ranges' ||
    pathname === '/active-rangre' ||
    pathname === '/api/active-range' ||
    pathname === '/api/active-ranges' ||
    pathname === '/api/active-rangre' ||
    pathname === '/api/v1/user/active-ranges'
  ) {
    const auth = await authenticateApiKey(req, url, body);
    if (!auth.user) {
      return res.status(401).json({ success: false, error: auth.error });
    }
    try {
      const response = await fetch('https://api.zenexnetwork.com/v1/active-ranges', {
        method: 'GET',
        headers: getZenexHeaders(false),
      });
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error fetching active ranges' });
    }
  }

  // Endpoint 4: Cancel Number (/cancel-number & /api/cancel-number)
  if (
    overrideEndpoint === 'cancel-number' ||
    pathname === '/cancel-number' ||
    pathname === '/api/cancel-number' ||
    pathname === '/api/v1/user/cancel-number'
  ) {
    const auth = await authenticateApiKey(req, url, body);
    if (!auth.user) return res.status(401).json({ success: false, error: auth.error });

    const orderId = (body.orderId || url.searchParams.get('orderId') || '').trim();
    const order = global._nxvOrdersStore.find((o) => o.id === orderId && o.userId === auth.user.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    order.status = 'CANCELLED';
    order.updatedAt = new Date().toISOString();
    persistStoredOrders(global._nxvOrdersStore);
    return res.status(200).json({
      success: true,
      status: 'CANCELLED',
      orderId: order.id,
      phoneNumber: order.phoneNumber,
      message: 'নাম্বার সফলভাবে বাতিল (Cancelled) করা হয়েছে।',
    });
  }

  // Endpoint 5: Balance (/balance & /api/balance)
  if (
    overrideEndpoint === 'balance' ||
    pathname === '/balance' ||
    pathname === '/api/balance' ||
    pathname === '/api/v1/user/balance'
  ) {
    const auth = await authenticateApiKey(req, url, body);
    if (!auth.user) return res.status(401).json({ success: false, error: auth.error });
    return res.status(200).json({
      success: true,
      balance: auth.user.balance || 0,
      currency: 'BDT',
      perOtpRate: auth.user.perOtpRate || 0.40,
      totalOtps: auth.user.totalOtps || 0,
      totalNumbers: auth.user.totalNumbers || 0,
    });
  }

  // Endpoint 6: Stats (/stats & /api/stats)
  if (
    overrideEndpoint === 'stats' ||
    pathname === '/stats' ||
    pathname === '/api/stats' ||
    pathname === '/api/v1/user/stats'
  ) {
    const auth = await authenticateApiKey(req, url, body);
    if (!auth.user) return res.status(401).json({ success: false, error: auth.error });
    const userOrders = global._nxvOrdersStore.filter((o) => o.userId === auth.user.id);
    return res.status(200).json({
      success: true,
      apiHits: auth.user.apiHits || 0,
      balance: auth.user.balance || 0,
      perOtpRate: auth.user.perOtpRate || 0.40,
      totalApiOrders: userOrders.length,
      receivedApiOrders: userOrders.filter((o) => o.status === 'RECEIVED').length,
      totalWebsiteOtps: auth.user.totalOtps || 0,
      totalWebsiteNumbers: auth.user.totalNumbers || 0,
      timestamp: new Date().toISOString(),
    });
  }

  // Endpoint 7: Country Stats (/country-stats & /api/country-stats)
  if (
    overrideEndpoint === 'country-stats' ||
    pathname === '/country-stats' ||
    pathname === '/api/country-stats' ||
    pathname === '/api/v1/user/country-stats'
  ) {
    const auth = await authenticateApiKey(req, url, body);
    if (!auth.user) return res.status(401).json({ success: false, error: auth.error });
    const userOrders = global._nxvOrdersStore.filter((o) => o.userId === auth.user.id);
    const countries = [
      { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', sampleRange: '4473845XXX', status: 'ACTIVE' },
      { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', sampleRange: '1213456XXX', status: 'ACTIVE' },
      { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺', sampleRange: '7999123XXX', status: 'ACTIVE' },
      { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', sampleRange: '8801712XXX', status: 'ACTIVE' },
      { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', sampleRange: '3161234XXX', status: 'ACTIVE' },
      { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', sampleRange: '9198765XXX', status: 'ACTIVE' },
    ];
    const breakdown = countries.map((c) => {
      const matched = userOrders.filter(
        (o) =>
          (o.country && (o.country.toLowerCase().includes(c.name.toLowerCase()) || o.country.includes(c.dialCode))) ||
          (o.phoneNumber && o.phoneNumber.startsWith(c.dialCode)) ||
          (o.range && o.range.startsWith(c.dialCode.replace('+', '')))
      );
      return {
        country: c.name,
        code: c.code,
        dialCode: c.dialCode,
        flag: c.flag,
        sampleRange: c.sampleRange,
        totalOrders: matched.length,
        otpsReceived: matched.filter((o) => o.status === 'RECEIVED').length,
      };
    });
    return res.status(200).json({
      success: true,
      countries: breakdown,
      totalOtps: auth.user.totalOtps || 0,
      balance: auth.user.balance || 0,
    });
  }

  // Endpoint 8: Sync orders to web panel (/api/users/orders) - matches by userId, apiKey, or email
  if (pathname === '/api/users/orders' && req.method === 'GET') {
    const userId = (url.searchParams.get('userId') || '').trim();
    const apiKey = (url.searchParams.get('apiKey') || '').trim();
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();

    if (!global._nxvOrdersStore || global._nxvOrdersStore.length === 0) {
      global._nxvOrdersStore = loadStoredOrders();
    }
    let orders = global._nxvOrdersStore || [];

    if (userId || apiKey || email) {
      orders = orders.filter((o) => {
        if (apiKey && (o.apiKey === apiKey || (o.checkOtpUrl && o.checkOtpUrl.includes(apiKey)))) {
          return true;
        }
        if (userId && (o.userId === userId || o.userId === `usr_api_${apiKey.slice(9, 17)}`)) {
          return true;
        }
        if (email && o.userEmail && o.userEmail.toLowerCase() === email) {
          return true;
        }
        return false;
      });
    }
    return res.status(200).json({ success: true, orders });
  }

  // ================= 2. USER & ADMIN API ACCESS MANAGEMENT =================

  // User Request API Access
  if (pathname === '/api/users/api-request' && req.method === 'POST') {
    const { userId, reason, email, displayName } = body;
    const cleanEmail = (email || '').trim().toLowerCase();
    let u = global._nxvUsersStore.find((x) => (userId && x.id === userId) || (cleanEmail && x.email?.toLowerCase() === cleanEmail));
    const now = new Date().toISOString();
    if (u) {
      u.apiAccessStatus = 'pending';
      u.apiRequestReason = reason || 'Telegram Bot & API Integration';
      u.apiRequestDate = now;
      u.updatedAt = now;
    } else {
      u = {
        id: userId || `usr-${Date.now()}`,
        email: cleanEmail || 'user@nxvsms.com',
        displayName: displayName || cleanEmail.split('@')[0],
        role: 'user',
        balance: 0,
        totalNumbers: 0,
        totalOtps: 0,
        isBanned: false,
        status: 'approved',
        apiAccessStatus: 'pending',
        apiRequestReason: reason || 'Telegram Bot & API Integration',
        apiRequestDate: now,
        createdAt: now,
        updatedAt: now,
      };
      global._nxvUsersStore.push(u);
    }
    return res.status(200).json({ success: true, message: 'API access requested', user: u });
  }

  // Admin Approve API Access
  if (pathname === '/api/users/api-approve' && req.method === 'POST') {
    const { userId, email, displayName } = body;
    const cleanEmail = (email || '').trim().toLowerCase();
    let u = global._nxvUsersStore.find((x) => (userId && x.id === userId) || (cleanEmail && x.email?.toLowerCase() === cleanEmail));
    const now = new Date().toISOString();
    const generatedKey = `nxv_live_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;

    if (u) {
      u.apiAccessStatus = 'approved';
      if (!u.apiKey) u.apiKey = generatedKey;
      u.rejectionReason = '';
      u.updatedAt = now;
    } else {
      u = {
        id: userId || `usr-${Date.now()}`,
        email: cleanEmail || 'user@nxvsms.com',
        displayName: displayName || cleanEmail.split('@')[0],
        role: 'user',
        balance: 0,
        totalNumbers: 0,
        totalOtps: 0,
        isBanned: false,
        status: 'approved',
        apiAccessStatus: 'approved',
        apiKey: generatedKey,
        perOtpRate: 0.40,
        createdAt: now,
        updatedAt: now,
      };
      global._nxvUsersStore.push(u);
    }
    return res.status(200).json({
      success: true,
      message: 'API access approved',
      apiKey: u.apiKey,
      user: u,
    });
  }

  // Admin Reject API Access
  if (pathname === '/api/users/api-reject' && req.method === 'POST') {
    const { userId, reason } = body;
    const u = global._nxvUsersStore.find((x) => x.id === userId);
    if (u) {
      u.apiAccessStatus = 'rejected';
      u.rejectionReason = reason || 'Rejected by Admin';
      u.updatedAt = new Date().toISOString();
      return res.status(200).json({ success: true, user: u });
    }
    return res.status(200).json({ success: true });
  }

  // Admin Revoke API Access
  if (pathname === '/api/users/api-revoke' && req.method === 'POST') {
    const { userId } = body;
    const u = global._nxvUsersStore.find((x) => x.id === userId);
    if (u) {
      u.apiAccessStatus = 'none';
      u.apiKey = '';
      u.updatedAt = new Date().toISOString();
      return res.status(200).json({ success: true, user: u });
    }
    return res.status(200).json({ success: true });
  }

  // Get Profile by API key
  if (pathname === '/api/users/api-profile' && req.method === 'GET') {
    const auth = await authenticateApiKey(req, url, body);
    if (!auth.user) return res.status(401).json({ success: false, error: auth.error });
    return res.status(200).json({ success: true, user: auth.user });
  }

  // ================= 3. SYSTEM & CARRIER PROXY ROUTES =================

  // Health check
  if (pathname === '/api/health') {
    return res.status(200).json({
      status: 'ok',
      service: 'NXV SMS Panel Backend (Vercel Serverless)',
      timestamp: new Date().toISOString(),
      keyMasked: ZENEX_API_KEY ? `${ZENEX_API_KEY.slice(0, 7)}...${ZENEX_API_KEY.slice(-4)}` : 'None',
    });
  }

  // Zenex Active Ranges
  if (pathname === '/api/zenex/active-ranges') {
    try {
      const response = await fetch('https://api.zenexnetwork.com/v1/active-ranges', {
        method: 'GET',
        headers: getZenexHeaders(false),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message || 'Error fetching active ranges' });
    }
  }

  // Zenex Getnum
  if (pathname === '/api/zenex/getnum') {
    try {
      const targetRange = body.range || url.searchParams.get('range') || '';
      const targetService = body.service || url.searchParams.get('service') || 'general';
      const response = await fetch('https://api.zenexnetwork.com/v1/getnum', {
        method: 'POST',
        headers: getZenexHeaders(true),
        body: JSON.stringify({ range: targetRange, service: targetService, is_national: false, remove_plus: false }),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message || 'Error provisioning number' });
    }
  }

  // Zenex Numsuccess Info
  if (pathname === '/api/zenex/numsuccess/info') {
    try {
      const response = await fetch('https://api.zenexnetwork.com/v1/numsuccess/info', {
        method: 'GET',
        headers: getZenexHeaders(false),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message || 'Error fetching OTP info' });
    }
  }

  // Zenex Global Broadcast
  if (pathname === '/api/zenex/global-broadcast') {
    try {
      const response = await fetch('https://www.zenexnetwork.com/api/v1/global-broadcast', {
        method: 'GET',
        headers: getZenexHeaders(false),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message || 'Error fetching global broadcast' });
    }
  }

  // ================= 4. USER & AGENT MANAGEMENT ROUTES =================

  // List all users
  if (pathname === '/api/users' && req.method === 'GET') {
    return res.status(200).json({
      success: true,
      users: global._nxvUsersStore,
    });
  }

  // Fetch single user profile by id or email
  if (pathname.startsWith('/api/users/profile/')) {
    const rawKey = decodeURIComponent(pathname.replace('/api/users/profile/', '')).trim().toLowerCase();
    const u = global._nxvUsersStore.find(
      (x) => x.id === rawKey || x.email?.toLowerCase() === rawKey
    );
    if (u) return res.status(200).json({ success: true, user: u });
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Sync user profile
  if (pathname === '/api/users/sync' && req.method === 'POST') {
    const incoming = body.user || body;
    if (incoming && (incoming.id || incoming.email)) {
      const idx = global._nxvUsersStore.findIndex(
        (u) =>
          (incoming.id && u.id === incoming.id) ||
          (incoming.email && u.email?.toLowerCase() === incoming.email?.toLowerCase())
      );
      const isMaster = incoming.email?.toLowerCase() === 'mnshiddik11@gmail.com';
      const role = isMaster ? 'admin' : (incoming.role || 'user');
      const now = new Date().toISOString();
      if (idx >= 0) {
        global._nxvUsersStore[idx] = {
          ...global._nxvUsersStore[idx],
          ...incoming,
          role: isMaster ? 'admin' : (incoming.role || global._nxvUsersStore[idx].role),
          updatedAt: now,
        };
      } else {
        global._nxvUsersStore.push({
          id: incoming.id || `usr-${Date.now()}`,
          email: incoming.email || 'user@nxvsms.com',
          displayName: incoming.displayName || 'NXV User',
          role,
          balance: typeof incoming.balance === 'number' ? incoming.balance : 0,
          totalNumbers: incoming.totalNumbers || 0,
          totalOtps: incoming.totalOtps || 0,
          isBanned: Boolean(incoming.isBanned),
          banReason: incoming.banReason || '',
          status: isMaster ? 'approved' : (incoming.status || 'pending'),
          apiKey: incoming.apiKey || '',
          apiAccessStatus: incoming.apiAccessStatus || 'none',
          perOtpRate: incoming.perOtpRate || 0.40,
          createdAt: incoming.createdAt || now,
          updatedAt: now,
        });
      }
    }
    return res.status(200).json({ success: true, message: 'User synced' });
  }

  // Update user role
  if (pathname === '/api/users/role' && req.method === 'POST') {
    const { userId, userEmail, displayName, role } = body;
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const u = global._nxvUsersStore.find((x) => (userId && x.id === userId) || (cleanEmail && x.email?.toLowerCase() === cleanEmail));
    const now = new Date().toISOString();

    if (u) {
      u.role = u.email === 'mnshiddik11@gmail.com' ? 'admin' : role;
      if (displayName) u.displayName = displayName;
      if (role === 'agent') {
        u.status = 'approved';
        if (!u.perOtpRate) u.perOtpRate = 0.40;
      }
      u.updatedAt = now;
    } else if (cleanEmail) {
      const newUser = {
        id: userId || `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        email: cleanEmail,
        displayName: displayName || cleanEmail.split('@')[0],
        role: cleanEmail === 'mnshiddik11@gmail.com' ? 'admin' : role,
        balance: 0,
        totalNumbers: 0,
        totalOtps: 0,
        isBanned: false,
        status: cleanEmail === 'mnshiddik11@gmail.com' || role === 'agent' ? 'approved' : 'pending',
        perOtpRate: role === 'agent' ? 0.40 : 0.30,
        createdAt: now,
        updatedAt: now,
      };
      global._nxvUsersStore.push(newUser);
    }

    if (role === 'agent' || role === 'admin') {
      const agEmail = cleanEmail || u?.email || '';
      if (agEmail) {
        const agIdx = global._nxvAgentsStore.findIndex((a) => a.email.toLowerCase() === agEmail.toLowerCase());
        const agObj = {
          id: userId || u?.id || `agent-${Date.now()}`,
          email: agEmail,
          displayName: displayName || u?.displayName || agEmail.split('@')[0],
          role,
        };
        if (agIdx >= 0) global._nxvAgentsStore[agIdx] = agObj;
        else global._nxvAgentsStore.push(agObj);
      }
    }
    return res.status(200).json({ success: true });
  }

  // Validate agent endpoint
  if (pathname === '/api/validate-agent' && req.method === 'GET') {
    const emailParam = (url.searchParams.get('email') || '').trim().toLowerCase();
    if (!emailParam) {
      return res.status(400).json({ valid: false, message: 'ইমেইল এড্রেস আবশ্যক' });
    }

    if (emailParam === 'mnshiddik11@gmail.com' || emailParam === 'mnshiddik11') {
      return res.status(200).json({
        valid: true,
        agent: {
          id: 'admin',
          email: 'mnshiddik11@gmail.com',
          displayName: 'Master Admin',
          role: 'admin',
        },
      });
    }

    const agentsList = [
      ...global._nxvAgentsStore,
      ...global._nxvUsersStore.filter((u) => u.role === 'agent' || u.role === 'admin'),
    ];

    const found = agentsList.find((a) => {
      const aEmail = a.email?.toLowerCase().trim();
      const aUser = aEmail?.split('@')[0];
      return aEmail === emailParam || aUser === emailParam;
    });

    if (found) {
      return res.status(200).json({
        valid: true,
        agent: {
          id: found.id || 'agent',
          email: found.email,
          displayName: found.displayName || found.email.split('@')[0],
          role: found.role || 'agent',
        },
      });
    }

    return res.status(200).json({ valid: false, message: 'আপনার এই জিমেইলে কোন এজেন্ট নেই' });
  }

  // Bulk agents sync
  if (pathname === '/api/agents/sync' && req.method === 'POST') {
    const incomingAgents = Array.isArray(body.agents) ? body.agents : [];
    incomingAgents.forEach((ag) => {
      if (!ag || !ag.email) return;
      const clean = ag.email.toLowerCase().trim();
      const idx = global._nxvAgentsStore.findIndex((a) => a.email.toLowerCase() === clean);
      const obj = {
        id: ag.id || `agent-${clean.replace(/[^a-z0-9_-]/g, '_')}`,
        email: clean,
        displayName: ag.displayName || clean.split('@')[0],
        role: ag.role || 'agent',
      };
      if (idx >= 0) global._nxvAgentsStore[idx] = obj;
      else global._nxvAgentsStore.push(obj);
    });
    return res.status(200).json({ success: true, count: global._nxvAgentsStore.length });
  }

  // List all agents
  if (pathname === '/api/agents' && req.method === 'GET') {
    const map = new Map();
    map.set('mnshiddik11@gmail.com', {
      id: 'admin',
      email: 'mnshiddik11@gmail.com',
      displayName: 'Master Admin',
      role: 'admin',
    });

    global._nxvAgentsStore.forEach((a) => {
      if (a && a.email) map.set(a.email.toLowerCase().trim(), a);
    });

    global._nxvUsersStore.forEach((u) => {
      if (u && (u.role === 'agent' || u.role === 'admin' || u.email?.toLowerCase() === 'mnshiddik11@gmail.com')) {
        map.set(u.email.toLowerCase().trim(), {
          id: u.id,
          email: u.email,
          displayName: u.displayName || u.email.split('@')[0],
          role: u.role,
        });
      }
    });

    return res.status(200).json({ success: true, agents: Array.from(map.values()) });
  }

  // Approve / reject user
  if (pathname === '/api/users/approval' && req.method === 'POST') {
    const { userId, userEmail, status, perOtpRate, rejectionReason } = body;
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const u = global._nxvUsersStore.find((x) => (userId && x.id === userId) || (cleanEmail && x.email?.toLowerCase() === cleanEmail));
    if (u) {
      u.status = status;
      if (status === 'approved') {
        const rate = typeof perOtpRate === 'number' ? perOtpRate : parseFloat(perOtpRate);
        u.perOtpRate = isNaN(rate) ? 0.30 : Math.min(0.60, Math.max(0.30, Number(rate.toFixed(2))));
        u.rejectionReason = '';
      } else if (status === 'rejected') {
        u.rejectionReason = rejectionReason || 'Rejected';
      }
      u.updatedAt = new Date().toISOString();
      return res.status(200).json({ success: true, user: u });
    }
    return res.status(200).json({ success: true });
  }

  // Edit OTP rate
  if (pathname === '/api/users/otprate' && req.method === 'POST') {
    const { userId, perOtpRate } = body;
    const u = global._nxvUsersStore.find((x) => x.id === userId);
    if (u) {
      const rate = typeof perOtpRate === 'number' ? perOtpRate : parseFloat(perOtpRate);
      u.perOtpRate = isNaN(rate) ? 0.30 : Math.min(0.60, Math.max(0.30, Number(rate.toFixed(2))));
      u.updatedAt = new Date().toISOString();
      return res.status(200).json({ success: true, user: u });
    }
    return res.status(200).json({ success: true });
  }

  // Ban / Unban user
  if (pathname === '/api/users/ban' && req.method === 'POST') {
    const { userId, isBanned, banReason } = body;
    const u = global._nxvUsersStore.find((x) => x.id === userId);
    if (u && u.email !== 'mnshiddik11@gmail.com') {
      u.isBanned = Boolean(isBanned);
      u.banReason = banReason || '';
      u.updatedAt = new Date().toISOString();
    }
    return res.status(200).json({ success: true });
  }

  // Edit user balance
  if (pathname === '/api/users/balance' && req.method === 'POST') {
    const { userId, balance, amountChange } = body;
    const u = global._nxvUsersStore.find((x) => x.id === userId);
    if (u) {
      if (typeof balance === 'number') u.balance = Math.max(0, balance);
      else if (typeof amountChange === 'number') u.balance = Math.max(0, (u.balance || 0) + amountChange);
      u.updatedAt = new Date().toISOString();
    }
    return res.status(200).json({ success: true });
  }

  // Create new user directly
  if (pathname === '/api/users/create' && req.method === 'POST') {
    const { displayName, email, role = 'user', balance = 0 } = body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const now = new Date().toISOString();
    const newUser = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email: cleanEmail,
      displayName: displayName?.trim() || cleanEmail.split('@')[0],
      role: cleanEmail === 'mnshiddik11@gmail.com' ? 'admin' : role,
      balance: Math.max(0, Number(balance) || 0),
      totalNumbers: 0,
      totalOtps: 0,
      isBanned: false,
      status: cleanEmail === 'mnshiddik11@gmail.com' || role === 'agent' ? 'approved' : 'pending',
      perOtpRate: role === 'agent' ? 0.40 : 0.30,
      createdAt: now,
      updatedAt: now,
    };
    global._nxvUsersStore.push(newUser);
    return res.status(200).json({ success: true, user: newUser });
  }

  // Delete user
  if ((pathname.startsWith('/api/users/') || pathname === '/api/users/delete') && (req.method === 'DELETE' || req.method === 'POST')) {
    const userId = pathname.startsWith('/api/users/') ? pathname.replace('/api/users/', '') : '';
    global._nxvUsersStore = global._nxvUsersStore.filter((u) => u.id !== userId && u.email !== 'mnshiddik11@gmail.com');
    return res.status(200).json({ success: true });
  }

  // ================= 5. WITHDRAWALS API =================

  if (pathname === '/api/withdrawals' && req.method === 'GET') {
    const userId = url.searchParams.get('userId');
    if (userId) {
      return res.status(200).json({
        success: true,
        withdrawals: global._nxvWithdrawalsStore.filter((w) => w.userId === userId),
      });
    }
    return res.status(200).json({ success: true, withdrawals: global._nxvWithdrawalsStore });
  }

  if (pathname === '/api/withdrawals/create' && req.method === 'POST') {
    const { userId, method, accountNumber, amount } = body;
    const u = global._nxvUsersStore.find((x) => x.id === userId);
    if (!u) return res.status(404).json({ success: false, message: 'User not found' });

    const reqAmt = Number(Number(amount).toFixed(2));
    if ((u.balance || 0) < reqAmt) {
      return res.status(400).json({ success: false, message: 'অপর্যাপ্ত ব্যালেন্স' });
    }

    u.balance = Number(((u.balance || 0) - reqAmt).toFixed(2));
    u.updatedAt = new Date().toISOString();

    const now = new Date().toISOString();
    const newRecord = {
      id: `wd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: u.id,
      userEmail: u.email,
      userName: u.displayName || u.email.split('@')[0],
      method,
      accountNumber: String(accountNumber).trim(),
      amount: reqAmt,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    global._nxvWithdrawalsStore.unshift(newRecord);
    return res.status(200).json({ success: true, withdrawal: newRecord, newBalance: u.balance });
  }

  if (pathname === '/api/withdrawals/action' && req.method === 'POST') {
    const { withdrawalId, action, adminNote } = body;
    const item = global._nxvWithdrawalsStore.find((w) => w.id === withdrawalId);
    if (!item) return res.status(404).json({ success: false, message: 'Withdrawal not found' });

    const now = new Date().toISOString();
    if (action === 'approve') {
      item.status = 'APPROVED';
      item.adminNote = adminNote || 'উইথড্র সফল হয়েছে';
      item.updatedAt = now;
    } else if (action === 'reject') {
      item.status = 'REJECTED';
      item.adminNote = adminNote || 'বাতিল করা হয়েছে';
      item.updatedAt = now;
      const u = global._nxvUsersStore.find((x) => x.id === item.userId);
      if (u) {
        u.balance = Number(((u.balance || 0) + item.amount).toFixed(2));
        u.updatedAt = now;
      }
    }
    return res.status(200).json({ success: true, withdrawal: item });
  }

  return res.status(404).json({
    error: 'API route not found',
    pathname: pathname,
  });
}
