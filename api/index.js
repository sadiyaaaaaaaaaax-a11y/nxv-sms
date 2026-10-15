// Vercel Serverless Function handler for /api/* routes
const ZENEX_API_KEY = process.env.ZENEX_API_KEY || 'ZNX_PJVG9XBZ6NBSLIAIK884NZ4I';

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

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse path
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Health check
  if (pathname === '/api/health') {
    return res.status(200).json({
      status: 'ok',
      service: 'NXV SMS Panel Backend (Vercel Serverless)',
      timestamp: new Date().toISOString(),
      keyMasked: ZENEX_API_KEY ? `${ZENEX_API_KEY.slice(0, 7)}...${ZENEX_API_KEY.slice(-4)}` : 'None',
    });
  }

  // 2. Active Ranges
  if (pathname === '/api/zenex/active-ranges') {
    try {
      const response = await fetch('https://api.zenexnetwork.com/v1/active-ranges', {
        method: 'GET',
        headers: getZenexHeaders(false),
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Error fetching active ranges',
      });
    }
  }

  // 3. Get Number (POST or GET)
  if (pathname === '/api/zenex/getnum') {
    try {
      let targetRange = '';
      let targetService = 'general';

      if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        targetRange = body.range || '';
        targetService = body.service || 'general';
      } else {
        targetRange = url.searchParams.get('range') || '';
        targetService = url.searchParams.get('service') || 'general';
      }

      const response = await fetch('https://api.zenexnetwork.com/v1/getnum', {
        method: 'POST',
        headers: getZenexHeaders(true),
        body: JSON.stringify({
          range: targetRange,
          service: targetService,
          is_national: false,
          remove_plus: false,
        }),
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Error provisioning number from carrier gateway',
      });
    }
  }

  // 4. Fetch OTPs / Success info
  if (pathname === '/api/zenex/numsuccess/info') {
    try {
      const response = await fetch('https://api.zenexnetwork.com/v1/numsuccess/info', {
        method: 'GET',
        headers: getZenexHeaders(false),
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Error fetching OTP info',
      });
    }
  }

  // 5. Global Broadcast
  if (pathname === '/api/zenex/global-broadcast') {
    try {
      const response = await fetch('https://www.zenexnetwork.com/api/v1/global-broadcast', {
        method: 'GET',
        headers: getZenexHeaders(false),
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Error fetching global broadcast',
      });
    }
  }

  // 6. User Management APIs (/api/users/*)
  if (pathname === '/api/users' && req.method === 'GET') {
    return res.status(200).json({
      success: true,
      users: global._nxvUsersStore || [
        {
          id: 'admin_mnshiddik11',
          email: 'mnshiddik11@gmail.com',
          displayName: 'Master Admin',
          role: 'admin',
          balance: 100.0,
          totalNumbers: 0,
          totalOtps: 0,
          isBanned: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  }

  if (pathname === '/api/users/sync' && req.method === 'POST') {
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
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: new Date().toISOString(),
        },
      ];
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
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
          createdAt: incoming.createdAt || now,
          updatedAt: now,
        });
      }
    }
    return res.status(200).json({ success: true, message: 'User synced' });
  }

  if (pathname === '/api/users/role' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { userId, userEmail, displayName, role } = body;
    if (!global._nxvUsersStore) global._nxvUsersStore = [];
    if (!global._nxvAgentsStore) global._nxvAgentsStore = [];

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

  // Validate Agent Endpoint for Vercel
  if (pathname === '/api/validate-agent' && req.method === 'GET') {
    const emailParam = (url.searchParams.get('email') || '').trim().toLowerCase();
    if (!emailParam) {
      return res.status(400).json({ valid: false, message: 'ইমেইল এড্রেস আবশ্যক' });
    }

    // Master admin is always authorized
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
      ...(global._nxvAgentsStore || []),
      ...(global._nxvUsersStore || []).filter((u) => u.role === 'agent' || u.role === 'admin'),
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
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const incomingAgents = Array.isArray(body.agents) ? body.agents : [];
    if (!global._nxvAgentsStore) global._nxvAgentsStore = [];
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

  if (pathname === '/api/agents' && req.method === 'GET') {
    const map = new Map();
    // Default Master Admin
    map.set('mnshiddik11@gmail.com', {
      id: 'admin',
      email: 'mnshiddik11@gmail.com',
      displayName: 'Master Admin',
      role: 'admin',
    });

    (global._nxvAgentsStore || []).forEach((a) => {
      if (a && a.email) map.set(a.email.toLowerCase().trim(), a);
    });

    (global._nxvUsersStore || []).forEach((u) => {
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

  if (pathname === '/api/users/approval' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { userId, userEmail, status, perOtpRate, rejectionReason } = body;
    if (!global._nxvUsersStore) global._nxvUsersStore = [];
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

  if (pathname === '/api/users/otprate' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { userId, perOtpRate } = body;
    if (global._nxvUsersStore) {
      const u = global._nxvUsersStore.find((x) => x.id === userId);
      if (u) {
        const rate = typeof perOtpRate === 'number' ? perOtpRate : parseFloat(perOtpRate);
        u.perOtpRate = isNaN(rate) ? 0.30 : Math.min(0.60, Math.max(0.30, Number(rate.toFixed(2))));
        u.updatedAt = new Date().toISOString();
        return res.status(200).json({ success: true, user: u });
      }
    }
    return res.status(200).json({ success: true });
  }

  if (pathname === '/api/users/credit-otp' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { userId, amount } = body;
    if (global._nxvUsersStore) {
      const u = global._nxvUsersStore.find((x) => x.id === userId);
      if (u) {
        const rate = typeof amount === 'number' && amount > 0 ? amount : (u.perOtpRate || 0.30);
        u.balance = Number(((u.balance || 0) + rate).toFixed(2));
        u.totalOtps = (u.totalOtps || 0) + 1;
        u.updatedAt = new Date().toISOString();
        return res.status(200).json({ success: true, credited: rate, newBalance: u.balance, totalOtps: u.totalOtps });
      }
    }
    return res.status(200).json({ success: true });
  }

  if ((pathname.startsWith('/api/users/') || pathname === '/api/users/delete') && (req.method === 'DELETE' || req.method === 'POST')) {
    const userId = pathname.startsWith('/api/users/') ? pathname.replace('/api/users/', '') : '';
    if (global._nxvUsersStore) {
      global._nxvUsersStore = global._nxvUsersStore.filter((u) => u.id !== userId && u.email !== 'mnshiddik11@gmail.com');
    }
    return res.status(200).json({ success: true });
  }

  // Withdrawals API
  if (pathname === '/api/withdrawals' && req.method === 'GET') {
    if (!global._nxvWithdrawalsStore) global._nxvWithdrawalsStore = [];
    const userId = req.query?.userId || parsedUrl.searchParams.get('userId');
    if (userId) {
      return res.status(200).json({
        success: true,
        withdrawals: global._nxvWithdrawalsStore.filter((w) => w.userId === userId),
      });
    }
    return res.status(200).json({ success: true, withdrawals: global._nxvWithdrawalsStore });
  }

  if (pathname === '/api/withdrawals/create' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { userId, method, accountNumber, amount } = body;
    if (!global._nxvWithdrawalsStore) global._nxvWithdrawalsStore = [];
    if (!global._nxvUsersStore) global._nxvUsersStore = [];

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
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { withdrawalId, action, adminNote } = body;
    if (!global._nxvWithdrawalsStore) global._nxvWithdrawalsStore = [];
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
      if (global._nxvUsersStore) {
        const u = global._nxvUsersStore.find((x) => x.id === item.userId);
        if (u) {
          u.balance = Number(((u.balance || 0) + item.amount).toFixed(2));
          u.updatedAt = now;
        }
      }
    }
    return res.status(200).json({ success: true, withdrawal: item });
  }

  return res.status(404).json({
    error: 'API route not found',
    pathname: pathname,
  });
}
