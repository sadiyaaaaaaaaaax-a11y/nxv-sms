import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './apiRoutes';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(apiRouter);

// Persistent User Database storage
interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'agent' | 'admin';
  balance: number;
  totalNumbers: number;
  totalOtps: number;
  isBanned?: boolean;
  banReason?: string;
  agentEmail?: string;
  status?: 'pending' | 'approved' | 'rejected';
  perOtpRate?: number;
  agentCommissionEarned?: number;
  // External Bot & API Access Integration
  apiKey?: string;
  apiAccessStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  apiHits?: number;
  apiRequestReason?: string;
  apiRequestDate?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

const USERS_FILE = path.resolve(__dirname, 'users_db.json');
const WITHDRAWALS_FILE = path.resolve(__dirname, 'withdrawals_db.json');
const ORDERS_FILE = path.resolve(__dirname, 'orders_db.json');

export interface PersistentOrder {
  id: string;
  userId: string;
  userEmail: string;
  phoneNumber: string;
  service: string;
  country?: string;
  range: string;
  status: 'WAITING' | 'RECEIVED' | 'EXPIRED' | 'CANCELLED';
  otpCode?: string;
  fullMessage?: string;
  credited?: boolean;
  earnedAmount?: number;
  source: 'api' | 'web';
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

function readOrdersFromFile(): PersistentOrder[] {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.error('Error reading orders_db.json:', err);
  }
  return [];
}

function saveOrdersToFile(list: PersistentOrder[]) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving orders_db.json:', err);
  }
}

interface WithdrawalRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  method: 'bkash' | 'nagad' | 'binance';
  accountNumber: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

function readWithdrawalsFromFile(): WithdrawalRecord[] {
  try {
    if (fs.existsSync(WITHDRAWALS_FILE)) {
      const data = fs.readFileSync(WITHDRAWALS_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.error('Error reading withdrawals_db.json:', err);
  }
  return [];
}

function saveWithdrawalsToFile(list: WithdrawalRecord[]) {
  try {
    fs.writeFileSync(WITHDRAWALS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving withdrawals_db.json:', err);
  }
}

function readUsersFromFile(): UserRecord[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.error('Error reading users_db.json:', err);
  }
  // Initialize with Master Admin
  const defaultList: UserRecord[] = [
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
  saveUsersToFile(defaultList);
  return defaultList;
}

function saveUsersToFile(users: UserRecord[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving users_db.json:', err);
  }
}

// User Management API
app.get('/api/users', (_req: Request, res: Response) => {
  const users = readUsersFromFile();
  res.json({ success: true, users });
});

app.get('/api/users/profile/:identifier', (req: Request, res: Response) => {
  const { identifier } = req.params;
  const users = readUsersFromFile();
  const clean = (identifier || '').trim().toLowerCase();
  const user = users.find(
    (u) => u.id === identifier || u.email?.toLowerCase() === clean
  );
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  return res.json({ success: true, user });
});

app.post('/api/users/sync', (req: Request, res: Response) => {
  const incoming = (req.body.user || req.body) as Partial<UserRecord>;
  if (!incoming || (!incoming.id && !incoming.email)) {
    return res.status(400).json({ success: false, message: 'Invalid user payload' });
  }

  const users = readUsersFromFile();
  const existingIdx = users.findIndex(
    (u) =>
      (incoming.id && u.id === incoming.id) ||
      (incoming.email && u.email?.toLowerCase() === incoming.email?.toLowerCase())
  );

  const isMaster = incoming.email?.toLowerCase() === 'mnshiddik11@gmail.com';
  const role = isMaster ? 'admin' : (incoming.role || 'user');

  const now = new Date().toISOString();
  if (existingIdx >= 0) {
    users[existingIdx] = {
      ...users[existingIdx],
      ...incoming,
      id: incoming.id || users[existingIdx].id,
      email: incoming.email || users[existingIdx].email,
      displayName: incoming.displayName || users[existingIdx].displayName,
      role: isMaster ? 'admin' : (incoming.role || users[existingIdx].role),
      balance: typeof incoming.balance === 'number' ? incoming.balance : users[existingIdx].balance,
      totalNumbers: typeof incoming.totalNumbers === 'number' ? incoming.totalNumbers : users[existingIdx].totalNumbers,
      totalOtps: typeof incoming.totalOtps === 'number' ? incoming.totalOtps : users[existingIdx].totalOtps,
      isBanned: typeof incoming.isBanned === 'boolean' ? incoming.isBanned : users[existingIdx].isBanned,
      banReason: incoming.banReason !== undefined ? incoming.banReason : users[existingIdx].banReason,
      agentEmail: incoming.agentEmail !== undefined ? incoming.agentEmail : users[existingIdx].agentEmail,
      status: isMaster ? 'approved' : (incoming.status !== undefined ? incoming.status : users[existingIdx].status),
      perOtpRate: typeof incoming.perOtpRate === 'number' ? incoming.perOtpRate : users[existingIdx].perOtpRate,
      agentCommissionEarned: typeof incoming.agentCommissionEarned === 'number' ? incoming.agentCommissionEarned : users[existingIdx].agentCommissionEarned,
      apiKey: incoming.apiKey !== undefined ? incoming.apiKey : users[existingIdx].apiKey,
      apiAccessStatus: incoming.apiAccessStatus !== undefined ? incoming.apiAccessStatus : users[existingIdx].apiAccessStatus,
      apiHits: typeof incoming.apiHits === 'number' ? incoming.apiHits : users[existingIdx].apiHits,
      apiRequestReason: incoming.apiRequestReason !== undefined ? incoming.apiRequestReason : users[existingIdx].apiRequestReason,
      apiRequestDate: incoming.apiRequestDate !== undefined ? incoming.apiRequestDate : users[existingIdx].apiRequestDate,
      rejectionReason: incoming.rejectionReason !== undefined ? incoming.rejectionReason : users[existingIdx].rejectionReason,
      updatedAt: now,
    };
  } else {
    const newUser: UserRecord = {
      id: incoming.id || `usr-${Date.now()}`,
      email: incoming.email || 'user@nxvsms.com',
      displayName: incoming.displayName || 'NXV User',
      role,
      balance: typeof incoming.balance === 'number' ? incoming.balance : 0,
      totalNumbers: incoming.totalNumbers || 0,
      totalOtps: incoming.totalOtps || 0,
      isBanned: Boolean(incoming.isBanned),
      banReason: incoming.banReason || '',
      agentEmail: incoming.agentEmail || '',
      status: isMaster ? 'approved' : (incoming.status || (incoming.agentEmail ? 'pending' : 'approved')),
      perOtpRate: typeof incoming.perOtpRate === 'number' ? incoming.perOtpRate : 0.30,
      apiKey: incoming.apiKey || '',
      apiAccessStatus: incoming.apiAccessStatus || 'none',
      apiHits: incoming.apiHits || 0,
      apiRequestReason: incoming.apiRequestReason || '',
      apiRequestDate: incoming.apiRequestDate || '',
      rejectionReason: incoming.rejectionReason || '',
      createdAt: incoming.createdAt || now,
      updatedAt: now,
    };
    users.push(newUser);
  }

  saveUsersToFile(users);
  return res.json({ success: true, message: 'User synced successfully' });
});

app.post('/api/users/role', (req: Request, res: Response) => {
  const { userId, userEmail, displayName, role } = req.body;
  if ((!userId && !userEmail) || !role) {
    return res.status(400).json({ success: false, message: 'Missing userId/userEmail or role' });
  }

  const users = readUsersFromFile();
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  let idx = users.findIndex(
    (u) => (userId && u.id === userId) || (cleanEmail && u.email?.toLowerCase() === cleanEmail)
  );

  if (idx !== -1) {
    if (users[idx].email === 'mnshiddik11@gmail.com' && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot demote Master Admin' });
    }
    users[idx].role = role;
    if (displayName && !users[idx].displayName) users[idx].displayName = displayName;
    if (role === 'agent' && users[idx].status === 'pending') {
      users[idx].status = 'approved';
    }
    users[idx].updatedAt = new Date().toISOString();
  } else {
    // If not found in users_db.json, create/upsert user record
    const isMaster = cleanEmail === 'mnshiddik11@gmail.com';
    const newUser: UserRecord = {
      id: userId || `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email: cleanEmail || 'user@nxvsms.com',
      displayName: displayName || cleanEmail.split('@')[0] || 'User',
      role: isMaster ? 'admin' : role,
      balance: 0,
      totalNumbers: 0,
      totalOtps: 0,
      isBanned: false,
      status: isMaster || role === 'agent' ? 'approved' : 'pending',
      perOtpRate: 0.30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(newUser);
  }

  saveUsersToFile(users);
  return res.json({ success: true, message: `Role updated to ${role}` });
});

app.post('/api/users/ban', (req: Request, res: Response) => {
  const { userId, isBanned, banReason } = req.body;
  if (!userId || typeof isBanned !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Missing userId or isBanned' });
  }

  const users = readUsersFromFile();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (users[idx].email === 'mnshiddik11@gmail.com') {
    return res.status(400).json({ success: false, message: 'Cannot ban Master Admin' });
  }

  users[idx].isBanned = isBanned;
  users[idx].banReason = banReason || '';
  users[idx].updatedAt = new Date().toISOString();
  saveUsersToFile(users);
  return res.json({ success: true, message: isBanned ? 'User banned' : 'User unbanned' });
});

app.post('/api/users/balance', (req: Request, res: Response) => {
  const { userId, balance, amountChange } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'Missing userId' });
  }

  const users = readUsersFromFile();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (typeof balance === 'number') {
    users[idx].balance = Math.max(0, balance);
  } else if (typeof amountChange === 'number') {
    users[idx].balance = Math.max(0, (users[idx].balance || 0) + amountChange);
  }

  users[idx].updatedAt = new Date().toISOString();
  saveUsersToFile(users);
  return res.json({ success: true, balance: users[idx].balance });
});

app.post('/api/users/create', (req: Request, res: Response) => {
  const { displayName, email, role = 'user', balance = 0 } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const users = readUsersFromFile();
  const cleanEmail = email.trim().toLowerCase();
  const existing = users.find((u) => u.email?.toLowerCase() === cleanEmail);
  const now = new Date().toISOString();
  const isMaster = cleanEmail === 'mnshiddik11@gmail.com';

  if (existing) {
    existing.role = isMaster ? 'admin' : (role || existing.role);
    if (displayName) existing.displayName = displayName.trim();
    if (typeof balance === 'number') existing.balance = balance;
    if (role === 'agent' && existing.status === 'pending') {
      existing.status = 'approved';
    }
    existing.updatedAt = now;
    saveUsersToFile(users);
    return res.json({ success: true, user: existing, message: 'User role updated' });
  }

  const agentEmailParam = (req.body.agentEmail || '').trim().toLowerCase();
  if (agentEmailParam) {
    const validAgent = users.find((u) => {
      const isAgent = u.role === 'agent' || u.role === 'admin' || u.email.toLowerCase() === 'mnshiddik11@gmail.com';
      if (!isAgent) return false;
      const cleanAg = u.email.trim().toLowerCase();
      return cleanAg === agentEmailParam || cleanAg.split('@')[0] === agentEmailParam;
    });

    if (!validAgent && agentEmailParam !== 'mnshiddik11@gmail.com') {
      return res.status(400).json({ success: false, message: 'আপনার এই জিমেইলে কোন এজেন্ট নেই' });
    }
  }

  const newUser: UserRecord = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email: cleanEmail,
    displayName: displayName?.trim() || cleanEmail.split('@')[0],
    role: isMaster ? 'admin' : role,
    balance: Math.max(0, Number(balance) || 0),
    totalNumbers: 0,
    totalOtps: 0,
    isBanned: false,
    agentEmail: agentEmailParam,
    // ONLY master admin gets approved automatically. All other new users must be pending!
    status: isMaster ? 'approved' : 'pending',
    perOtpRate: typeof req.body.perOtpRate === 'number' ? Math.min(0.60, Math.max(0.30, req.body.perOtpRate)) : 0.30,
    rejectionReason: req.body.rejectionReason || '',
    createdAt: now,
    updatedAt: now,
  };

  users.push(newUser);
  saveUsersToFile(users);
  return res.json({ success: true, user: newUser });
});

// Get active agents list
app.get('/api/agents', (_req: Request, res: Response) => {
  const users = readUsersFromFile();
  const agents = users
    .filter((u) => u.role === 'agent' || u.role === 'admin' || u.email.toLowerCase() === 'mnshiddik11@gmail.com')
    .map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName || u.email.split('@')[0],
      role: u.role,
    }));
  return res.json({ success: true, agents });
});

// Bulk sync agents from client to server
app.post('/api/agents/sync', (req: Request, res: Response) => {
  const { agents } = req.body;
  if (!Array.isArray(agents)) {
    return res.status(400).json({ success: false, message: 'Invalid agents array' });
  }

  const users = readUsersFromFile();
  let updatedCount = 0;

  for (const ag of agents) {
    if (!ag || !ag.email) continue;
    const cleanAg = ag.email.trim().toLowerCase();
    const idx = users.findIndex(
      (u) => (ag.id && u.id === ag.id) || u.email.toLowerCase() === cleanAg
    );

    if (idx >= 0) {
      if (users[idx].email !== 'mnshiddik11@gmail.com') {
        users[idx].role = ag.role || 'agent';
      }
      if (ag.displayName) users[idx].displayName = ag.displayName;
      if (users[idx].status === 'pending' && (users[idx].role === 'agent' || users[idx].role === 'admin')) {
        users[idx].status = 'approved';
      }
      users[idx].updatedAt = new Date().toISOString();
      updatedCount++;
    } else {
      users.push({
        id: ag.id || `ag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        email: cleanAg,
        displayName: ag.displayName || cleanAg.split('@')[0],
        role: ag.role || 'agent',
        balance: ag.balance || 0,
        totalNumbers: 0,
        totalOtps: 0,
        isBanned: false,
        status: 'approved',
        perOtpRate: 0.30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      updatedCount++;
    }
  }

  saveUsersToFile(users);
  return res.json({ success: true, updatedCount, total: users.length });
});

// Validate agent email before user registration
app.get('/api/validate-agent', (req: Request, res: Response) => {
  const emailParam = ((req.query.email as string) || (req.body?.email as string) || '').trim().toLowerCase();
  if (!emailParam) {
    return res.status(400).json({ valid: false, message: 'এজেন্ট ইমেইল প্রদান করুন' });
  }

  const users = readUsersFromFile();
  const agentFound = users.find((u) => {
    const isAgent = u.role === 'agent' || u.role === 'admin' || u.email.toLowerCase() === 'mnshiddik11@gmail.com';
    if (!isAgent) return false;
    const cleanAgentEmail = u.email.trim().toLowerCase();
    const agentUsername = cleanAgentEmail.split('@')[0];
    return cleanAgentEmail === emailParam || agentUsername === emailParam;
  });

  // Always consider master admin valid
  if (emailParam === 'mnshiddik11@gmail.com' || emailParam === 'mnshiddik11') {
    return res.json({
      valid: true,
      agent: {
        id: agentFound ? agentFound.id : 'master-admin',
        email: 'mnshiddik11@gmail.com',
        displayName: agentFound ? agentFound.displayName : 'Master Admin',
        role: 'admin',
      },
    });
  }

  if (agentFound) {
    return res.json({
      valid: true,
      agent: {
        id: agentFound.id,
        email: agentFound.email,
        displayName: agentFound.displayName || agentFound.email.split('@')[0],
        role: agentFound.role,
      },
    });
  }

  return res.json({
    valid: false,
    message: 'আপনার এই জিমেইলে কোন এজেন্ট নেই',
  });
});


// Agent approves or rejects a pending user
app.post('/api/users/approval', (req: Request, res: Response) => {
  const { userId, status, perOtpRate, rejectionReason } = req.body;
  if (!userId || !status) {
    return res.status(400).json({ success: false, message: 'Missing userId or status' });
  }

  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const users = readUsersFromFile();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  users[idx].status = status;
  if (status === 'approved') {
    const rate = typeof perOtpRate === 'number' ? perOtpRate : parseFloat(perOtpRate);
    // User requested: highest 0.60 BDT, lowest 0.30 BDT
    const safeRate = isNaN(rate) ? 0.30 : Math.min(0.60, Math.max(0.30, Number(rate.toFixed(2))));
    users[idx].perOtpRate = safeRate;
    users[idx].rejectionReason = '';
  } else if (status === 'rejected') {
    users[idx].rejectionReason = rejectionReason || 'Rejected by Agent';
  }

  users[idx].updatedAt = new Date().toISOString();
  saveUsersToFile(users);
  return res.json({ success: true, user: users[idx] });
});

// Update OTP rate for an approved user (0.30 to 0.60 BDT)
app.post('/api/users/otprate', (req: Request, res: Response) => {
  const { userId, perOtpRate } = req.body;
  if (!userId || perOtpRate === undefined) {
    return res.status(400).json({ success: false, message: 'Missing userId or perOtpRate' });
  }

  const rate = typeof perOtpRate === 'number' ? perOtpRate : parseFloat(perOtpRate);
  const safeRate = isNaN(rate) ? 0.30 : Math.min(0.60, Math.max(0.30, Number(rate.toFixed(2))));

  const users = readUsersFromFile();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  users[idx].perOtpRate = safeRate;
  users[idx].updatedAt = new Date().toISOString();
  saveUsersToFile(users);
  return res.json({ success: true, perOtpRate: safeRate, user: users[idx] });
});

// Credit user on OTP received
app.post('/api/users/credit-otp', (req: Request, res: Response) => {
  const { userId, amount } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'Missing userId' });
  }

  const users = readUsersFromFile();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const user = users[idx];
  const isAgent = user.role === 'agent';

  // 1. Agent account receiving OTP gets exactly 0.50 BDT (৫০ পয়সা)
  // 2. Regular user gets configured rate (0.30 to 0.60 BDT, default 0.30 BDT)
  let rateToCredit = isAgent 
    ? 0.50 
    : (typeof amount === 'number' && amount >= 0.30 
        ? Math.min(0.60, amount) 
        : (user.perOtpRate && user.perOtpRate >= 0.30 ? Math.min(0.60, user.perOtpRate) : 0.30));

  rateToCredit = Number(rateToCredit.toFixed(2));

  user.balance = Number(((user.balance || 0) + rateToCredit).toFixed(2));
  user.totalOtps = (user.totalOtps || 0) + 1;
  user.updatedAt = new Date().toISOString();

  // 3. Agent Commission logic:
  // "ম্যাক্স ইনকাম হলো ৬০ পয়সা... ৬০ পয়সার ভেতরে এজেন্ট ইউজারকে যত পয়সা দেবে তার মধ্যে ৬০ পয়সা হতে যত পয়সা বাঁচবে ইউজার পেয়ে সেগুলা এজেন্টের একাউন্টে জমা হবে"
  let agentCredited = 0;
  let agentRecord: UserRecord | undefined;

  if (!isAgent && user.agentEmail) {
    const cleanAgentEmail = user.agentEmail.trim().toLowerCase();
    const agentIdx = users.findIndex(
      (u) =>
        u.email?.toLowerCase() === cleanAgentEmail ||
        u.email?.toLowerCase().split('@')[0] === cleanAgentEmail
    );

    if (agentIdx !== -1) {
      // 0.60 - user rate (e.g. 0.60 - 0.30 = 0.30 BDT, 0.60 - 0.40 = 0.20 BDT)
      const commission = Math.max(0, Number((0.60 - rateToCredit).toFixed(2)));
      if (commission > 0) {
        agentCredited = commission;
        users[agentIdx].balance = Number(((users[agentIdx].balance || 0) + commission).toFixed(2));
        users[agentIdx].agentCommissionEarned = Number(
          ((users[agentIdx].agentCommissionEarned || 0) + commission).toFixed(2)
        );
        users[agentIdx].updatedAt = new Date().toISOString();
        agentRecord = users[agentIdx];
      }
    }
  }

  saveUsersToFile(users);
  return res.json({
    success: true,
    credited: rateToCredit,
    newBalance: user.balance,
    totalOtps: user.totalOtps,
    isAgent,
    agentCredited,
    agentEmail: agentRecord?.email || user.agentEmail || '',
    agentId: agentRecord?.id,
    agentNewBalance: agentRecord?.balance,
  });
});

app.delete('/api/users/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  let users = readUsersFromFile();
  const target = users.find((u) => u.id === userId);
  if (target && target.email === 'mnshiddik11@gmail.com') {
    return res.status(400).json({ success: false, message: 'Cannot delete Master Admin' });
  }

  users = users.filter((u) => u.id !== userId);
  saveUsersToFile(users);
  return res.json({ success: true, message: 'User deleted' });
});

app.post('/api/users/delete', (req: Request, res: Response) => {
  const { userId } = req.body;
  let users = readUsersFromFile();
  const target = users.find((u) => u.id === userId);
  if (target && target.email === 'mnshiddik11@gmail.com') {
    return res.status(400).json({ success: false, message: 'Cannot delete Master Admin' });
  }

  users = users.filter((u) => u.id !== userId);
  saveUsersToFile(users);
  return res.json({ success: true, message: 'User deleted' });
});

// ================= Withdrawals API =================
// Get all withdrawals or user-specific withdrawals
app.get('/api/withdrawals', (req: Request, res: Response) => {
  const { userId } = req.query;
  const list = readWithdrawalsFromFile();
  if (userId && typeof userId === 'string') {
    const userList = list.filter((w) => w.userId === userId);
    return res.json({ success: true, withdrawals: userList });
  }
  return res.json({ success: true, withdrawals: list });
});

// User submits a new withdrawal request
app.post('/api/withdrawals/create', (req: Request, res: Response) => {
  const { userId, method, accountNumber, amount } = req.body;
  if (!userId || !method || !accountNumber || typeof amount !== 'number' || amount < 60) {
    return res.status(400).json({ success: false, message: 'সর্বনিম্ন উত্তোলন পরিমাণ ৬০ টাকা (Minimum withdraw is ৳60)' });
  }

  const validMethods = ['bkash', 'nagad', 'binance'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ success: false, message: 'অবৈধ উত্তোলন মেথড' });
  }

  const users = readUsersFromFile();
  const userIdx = users.findIndex((u) => u.id === userId);
  if (userIdx === -1) {
    return res.status(404).json({ success: false, message: 'ইউজার পাওয়া যায়নি' });
  }

  const user = users[userIdx];
  const requestedAmount = Number(amount.toFixed(2));
  if ((user.balance || 0) < requestedAmount) {
    return res.status(400).json({
      success: false,
      message: `অপর্যাপ্ত ব্যালেন্স! আপনার বর্তমান ব্যালেন্স: ৳${(user.balance || 0).toFixed(2)}`,
    });
  }

  // Deduct balance immediately
  user.balance = Number(((user.balance || 0) - requestedAmount).toFixed(2));
  user.updatedAt = new Date().toISOString();
  saveUsersToFile(users);

  const withdrawals = readWithdrawalsFromFile();
  const now = new Date().toISOString();
  const newRecord: WithdrawalRecord = {
    id: `wd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: user.id,
    userEmail: user.email,
    userName: user.displayName || user.email.split('@')[0],
    method,
    accountNumber: accountNumber.trim(),
    amount: requestedAmount,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };

  withdrawals.unshift(newRecord);
  saveWithdrawalsToFile(withdrawals);

  return res.json({
    success: true,
    message: 'উইথড্র রিকোয়েস্ট সফলভাবে জমা হয়েছে! এডমিন অনুমোদনের পর সম্পন্ন হবে।',
    withdrawal: newRecord,
    newBalance: user.balance,
  });
});

// Admin approves or rejects a withdrawal request
app.post('/api/withdrawals/action', (req: Request, res: Response) => {
  const { withdrawalId, action, adminNote } = req.body;
  if (!withdrawalId || !action || (action !== 'approve' && action !== 'reject')) {
    return res.status(400).json({ success: false, message: 'Invalid action parameters' });
  }

  const withdrawals = readWithdrawalsFromFile();
  const idx = withdrawals.findIndex((w) => w.id === withdrawalId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'উইথড্র রিকোয়েস্ট পাওয়া যায়নি' });
  }

  const item = withdrawals[idx];
  const now = new Date().toISOString();

  if (action === 'approve') {
    item.status = 'APPROVED';
    item.adminNote = adminNote?.trim() || 'উইথড্র সফল হয়েছে';
    item.updatedAt = now;
  } else if (action === 'reject') {
    item.status = 'REJECTED';
    item.adminNote = adminNote?.trim() || 'এডমিন কর্তৃক বাতিল';
    item.updatedAt = now;

    // Refund the amount back to user's balance!
    const users = readUsersFromFile();
    const userIdx = users.findIndex((u) => u.id === item.userId);
    if (userIdx >= 0) {
      users[userIdx].balance = Number(((users[userIdx].balance || 0) + item.amount).toFixed(2));
      users[userIdx].updatedAt = now;
      saveUsersToFile(users);
    }
  }

  saveWithdrawalsToFile(withdrawals);
  return res.json({ success: true, withdrawal: item });
});

// Official Zenex API Key provided by user
let zenexApiKey = process.env.ZENEX_API_KEY || 'ZNX_PJVG9XBZ6NBSLIAIK884NZ4I';

// Common Zenex Request Headers
function getZenexHeaders(isJson = false) {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'mapikey': zenexApiKey,
    'apikey': zenexApiKey,
    'api-key': zenexApiKey,
    'x-api-key': zenexApiKey,
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'NXV SMS Panel Backend Core',
    timestamp: new Date().toISOString(),
    keyMasked: zenexApiKey ? `${zenexApiKey.slice(0, 7)}...${zenexApiKey.slice(-4)}` : 'None',
  });
});

// Config API
app.get('/api/zenex/config', (_req: Request, res: Response) => {
  res.json({
    apiKey: zenexApiKey,
    apiKeyMasked: zenexApiKey ? `${zenexApiKey.slice(0, 7)}...${zenexApiKey.slice(-4)}` : '',
    hasKey: Boolean(zenexApiKey),
    endpoints: {
      getnum: 'https://api.zenexnetwork.com/v1/getnum',
      numsuccess: 'https://api.zenexnetwork.com/v1/numsuccess/info',
      activeRanges: 'https://api.zenexnetwork.com/v1/active-ranges',
      globalBroadcast: 'https://www.zenexnetwork.com/api/v1/global-broadcast',
    },
  });
});

app.post('/api/zenex/config', (req: Request, res: Response) => {
  const { apiKey } = req.body;
  if (typeof apiKey === 'string' && apiKey.trim()) {
    zenexApiKey = apiKey.trim();
  }
  res.json({
    success: true,
    message: 'API Key updated successfully',
    apiKeyMasked: zenexApiKey ? `${zenexApiKey.slice(0, 7)}...${zenexApiKey.slice(-4)}` : '',
  });
});

// 1. ACTIVE RANGES: GET https://api.zenexnetwork.com/v1/active-ranges
app.get('/api/zenex/active-ranges', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.zenexnetwork.com/v1/active-ranges', {
      method: 'GET',
      headers: getZenexHeaders(false),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Error connecting to active-ranges',
    });
  }
});

// 2. PROVISION VIRTUAL NUMBER: POST https://api.zenexnetwork.com/v1/getnum
app.post('/api/zenex/getnum', async (req: Request, res: Response) => {
  const { range, is_national = false, remove_plus = false } = req.body;

  try {
    let cleanRange = (range || '4473845XXX').trim();
    if (!cleanRange.includes('X') && cleanRange.length <= 7) {
      cleanRange = `${cleanRange}XXX`;
    }

    const payload = {
      range: cleanRange,
      is_national: Boolean(is_national),
      remove_plus: Boolean(remove_plus),
    };

    const response = await fetch('https://api.zenexnetwork.com/v1/getnum', {
      method: 'POST',
      headers: getZenexHeaders(true),
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Error connecting to getnum',
    });
  }
});

// GET /api/zenex/getnum wrapper for query parameters
app.get('/api/zenex/getnum', async (req: Request, res: Response) => {
  const range = (req.query.range as string) || '4473845XXX';

  try {
    let cleanRange = range.trim();
    if (!cleanRange.includes('X') && cleanRange.length <= 7) {
      cleanRange = `${cleanRange}XXX`;
    }

    const payload = {
      range: cleanRange,
      is_national: false,
      remove_plus: false,
    };

    const response = await fetch('https://api.zenexnetwork.com/v1/getnum', {
      method: 'POST',
      headers: getZenexHeaders(true),
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Error connecting to getnum',
    });
  }
});

// 3. FETCH SMS/OTP PAYLOADS: GET https://api.zenexnetwork.com/v1/numsuccess/info
app.get('/api/zenex/numsuccess/info', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.zenexnetwork.com/v1/numsuccess/info', {
      method: 'GET',
      headers: getZenexHeaders(false),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Error connecting to numsuccess/info',
    });
  }
});

// 4. GLOBAL LIVE CONSOLE: GET https://www.zenexnetwork.com/api/v1/global-broadcast
app.get('/api/zenex/global-broadcast', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://www.zenexnetwork.com/api/v1/global-broadcast', {
      method: 'GET',
      headers: getZenexHeaders(false),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Error connecting to global-broadcast',
    });
  }
});

// Start Server & mount Vite in dev mode
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NXV SMS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
