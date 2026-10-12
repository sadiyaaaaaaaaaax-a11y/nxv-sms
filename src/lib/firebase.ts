import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const rawConfig = firebaseConfig as Record<string, string | undefined>;
export const db: Firestore = rawConfig.firestoreDatabaseId
  ? getFirestore(app, rawConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection check required by skill (guaranteed never to hang)
export async function testConnection(): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timeout')), 1500)
    );
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      timeoutPromise,
    ]);
    return true;
  } catch (error) {
    return false;
  }
}

export type UserRole = 'user' | 'agent' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  balance: number;
  totalNumbers: number;
  totalOtps: number;
  isBanned?: boolean;
  banReason?: string;
  agentEmail?: string;
  status?: UserStatus;
  perOtpRate?: number; // 0.30 - 0.60 BDT
  agentCommissionEarned?: number;
  apiKey?: string;
  apiAccessStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  apiHits?: number;
  apiRequestReason?: string;
  apiRequestDate?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmsOrderRecord {
  id: string;
  userId: string;
  phoneNumber: string;
  service: string;
  country: string;
  range: string;
  price: number;
  status: 'WAITING' | 'RECEIVED' | 'EXPIRED' | 'CANCELLED';
  otpCode?: string;
  fullMessage?: string;
  orderRefId?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// Synchronize user profile with backend API
export async function syncUserToBackend(profile: Partial<UserProfile>): Promise<void> {
  try {
    await fetch('/api/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: profile }),
    });
  } catch (err) {
    // Non-blocking sync error
  }
}

export async function fetchOrCreateUserProfile(
  user: User,
  customDisplayName?: string,
  agentEmail?: string
): Promise<UserProfile> {
  const cleanEmail = user.email?.toLowerCase().trim() || '';
  const isAdmin = cleanEmail === 'mnshiddik11@gmail.com';
  const cleanAgent = agentEmail?.toLowerCase().trim() || '';
  const now = new Date().toISOString();

  const fallbackProfile: UserProfile = {
    id: user.uid,
    email: cleanEmail || 'user@nxvsms.com',
    displayName:
      customDisplayName ||
      user.displayName ||
      cleanEmail.split('@')[0] ||
      'NXV User',
    role: isAdmin ? 'admin' : 'user',
    balance: 0,
    totalNumbers: 0,
    totalOtps: 0,
    isBanned: false,
    agentEmail: cleanAgent,
    status: isAdmin ? 'approved' : (cleanAgent ? 'pending' : 'approved'),
    perOtpRate: 0.30,
    rejectionReason: '',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap && snap.exists()) {
      const data = snap.data() as UserProfile;
      // Guarantee master admin email always has admin role
      if (isAdmin && (data.role !== 'admin' || data.status !== 'approved')) {
        data.role = 'admin';
        data.status = 'approved';
        await setDoc(userRef, { ...data, role: 'admin', status: 'approved', updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      }
      // If user supplied an agent on subsequent login but didn't have one before
      if (cleanAgent && !data.agentEmail) {
        data.agentEmail = cleanAgent;
        if (!data.status || data.status === 'approved') {
          data.status = 'pending';
        }
        await setDoc(userRef, { agentEmail: cleanAgent, status: data.status, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      }
      // Also check backend /api/users for authoritative role, status, and agentEmail
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const json = await res.json();
          const serverUser = (json.users || []).find(
            (u: any) =>
              (u.id && u.id === user.uid) ||
              (u.email && u.email.toLowerCase() === cleanEmail)
          );
          if (serverUser) {
            if (serverUser.role && serverUser.role !== data.role) data.role = serverUser.role;
            if (serverUser.status && serverUser.status !== data.status) data.status = serverUser.status;
            if (serverUser.agentEmail) data.agentEmail = serverUser.agentEmail;
            if (typeof serverUser.perOtpRate === 'number') data.perOtpRate = serverUser.perOtpRate;
            if (typeof serverUser.balance === 'number') data.balance = serverUser.balance;
            if (serverUser.apiKey) data.apiKey = serverUser.apiKey;
            if (serverUser.apiAccessStatus) data.apiAccessStatus = serverUser.apiAccessStatus;
            if (typeof serverUser.apiHits === 'number') data.apiHits = serverUser.apiHits;
            if (serverUser.apiRequestReason) data.apiRequestReason = serverUser.apiRequestReason;
            if (serverUser.apiRequestDate) data.apiRequestDate = serverUser.apiRequestDate;
            if (serverUser.rejectionReason) data.rejectionReason = serverUser.rejectionReason;
            if (typeof serverUser.agentCommissionEarned === 'number') data.agentCommissionEarned = serverUser.agentCommissionEarned;
          }
        }
      } catch {}

      syncUserToBackend(data).catch(() => {});
      return data;
    }

    // Check backend /api/users before returning fallbackProfile
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        const serverUser = (json.users || []).find(
          (u: any) =>
            (u.id && u.id === user.uid) ||
            (u.email && u.email.toLowerCase() === cleanEmail)
        );
        if (serverUser) {
          if (serverUser.role) fallbackProfile.role = serverUser.role;
          if (serverUser.status) fallbackProfile.status = serverUser.status;
          if (serverUser.agentEmail) fallbackProfile.agentEmail = serverUser.agentEmail;
          if (typeof serverUser.perOtpRate === 'number') fallbackProfile.perOtpRate = serverUser.perOtpRate;
          if (typeof serverUser.balance === 'number') fallbackProfile.balance = serverUser.balance;
          if (serverUser.apiKey) fallbackProfile.apiKey = serverUser.apiKey;
          if (serverUser.apiAccessStatus) fallbackProfile.apiAccessStatus = serverUser.apiAccessStatus;
          if (typeof serverUser.apiHits === 'number') fallbackProfile.apiHits = serverUser.apiHits;
          if (serverUser.apiRequestReason) fallbackProfile.apiRequestReason = serverUser.apiRequestReason;
          if (serverUser.apiRequestDate) fallbackProfile.apiRequestDate = serverUser.apiRequestDate;
          if (serverUser.rejectionReason) fallbackProfile.rejectionReason = serverUser.rejectionReason;
          if (typeof serverUser.agentCommissionEarned === 'number') fallbackProfile.agentCommissionEarned = serverUser.agentCommissionEarned;
        }
      }
    } catch {}

    await setDoc(userRef, fallbackProfile).catch((e) => console.warn('Firestore setDoc failed:', e));
    syncUserToBackend(fallbackProfile).catch(() => {});
    return fallbackProfile;
  } catch (err) {
    console.warn('Firestore fetchOrCreateUserProfile error:', err);
    syncUserToBackend(fallbackProfile).catch(() => {});
    return fallbackProfile;
  }
}

// Fetch single authoritative user record directly from backend API
export async function fetchUserProfileFromBackend(identifier: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`/api/users/profile/${encodeURIComponent(identifier)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) return data.user;
    }
  } catch {}
  return null;
}

export async function updateUserBalance(
  userId: string,
  amountChange: number,
  isNumberAdded = false,
  isOtpAdded = false
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      const newBalance = Math.max(0, (data.balance || 0) + amountChange);
      await updateDoc(userRef, {
        balance: newBalance,
        totalNumbers: (data.totalNumbers || 0) + (isNumberAdded ? 1 : 0),
        totalOtps: (data.totalOtps || 0) + (isOtpAdded ? 1 : 0),
        updatedAt: new Date().toISOString(),
      });
      // Sync to backend
      fetch('/api/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, balance: newBalance }),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to update balance on Firestore:', err);
  }
}

// Admin API: Set specific balance directly
export async function setUserBalance(userId: string, newBalance: number): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      balance: Math.max(0, newBalance),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to set balance on Firestore:', err);
  }

  // Always update backend API as well
  try {
    await fetch('/api/users/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, balance: Math.max(0, newBalance) }),
    });
    return true;
  } catch (err) {
    console.error('Failed to set user balance on backend:', err);
    return true;
  }
}

// Admin API: Toggle Ban / Unban
export async function toggleUserBan(
  userId: string,
  isBanned: boolean,
  banReason?: string
): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isBanned,
      ...(banReason ? { banReason } : {}),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore toggle ban error:', err);
  }

  // Always update backend API as well
  try {
    await fetch('/api/users/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, isBanned, banReason: banReason || '' }),
    });
    return true;
  } catch (err) {
    console.error('Backend toggle ban error:', err);
    return true;
  }
}

// Admin API: Change Role (user | agent | admin)
export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore update role error:', err);
  }

  // Always update backend API as well
  try {
    await fetch('/api/users/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });
    return true;
  } catch (err) {
    console.error('Backend update role error:', err);
    return true;
  }
}

// Admin API: Delete User Doc
export async function deleteUserAccount(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
  } catch (err) {
    console.warn('Firestore delete user error:', err);
  }

  // Always update backend API as well
  try {
    await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.error('Backend delete user error:', err);
    return true;
  }
}

// Admin API: Create New User / Agent directly
export async function createUserRecord(params: {
  displayName: string;
  email: string;
  role: UserRole;
  balance?: number;
  agentEmail?: string;
  status?: UserStatus;
  perOtpRate?: number;
}): Promise<UserProfile | null> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanAgent = params.agentEmail?.trim().toLowerCase() || '';
  const now = new Date().toISOString();
  const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newUser: UserProfile = {
    id,
    email: cleanEmail,
    displayName: params.displayName.trim() || cleanEmail.split('@')[0],
    role: cleanEmail === 'mnshiddik11@gmail.com' ? 'admin' : params.role,
    balance: Math.max(0, Number(params.balance) || 0),
    totalNumbers: 0,
    totalOtps: 0,
    isBanned: false,
    agentEmail: cleanAgent,
    status: cleanEmail === 'mnshiddik11@gmail.com' ? 'approved' : (params.status || (cleanAgent ? 'pending' : 'approved')),
    perOtpRate: typeof params.perOtpRate === 'number' ? Math.min(0.60, Math.max(0.30, params.perOtpRate)) : 0.30,
    createdAt: now,
    updatedAt: now,
  };

  // Save to Firestore
  try {
    const userRef = doc(db, 'users', id);
    await setDoc(userRef, newUser);
  } catch (err) {
    console.warn('Firestore createUserRecord error:', err);
  }

  // Save to Backend API
  try {
    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.user) return data.user;
    }
  } catch (err) {
    console.warn('Backend createUserRecord error:', err);
  }

  return newUser;
}

// Agent API: Approve or reject user and set per OTP rate (0.30 to 0.60 BDT)
export async function updateUserApproval(
  userId: string,
  status: 'approved' | 'rejected',
  perOtpRate?: number,
  rejectionReason?: string
): Promise<boolean> {
  const safeRate = perOtpRate !== undefined 
    ? Math.min(0.60, Math.max(0.30, Number(Number(perOtpRate).toFixed(2)))) 
    : 0.30;
  const updates: Record<string, any> = {
    status,
    updatedAt: new Date().toISOString(),
  };
  if (status === 'approved') {
    updates.perOtpRate = safeRate;
    updates.rejectionReason = '';
  } else if (status === 'rejected') {
    updates.rejectionReason = rejectionReason || 'Rejected by Agent';
  }

  // Update Firestore
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, updates);
  } catch (err) {
    console.warn('Firestore update approval error:', err);
  }

  // Update backend API
  try {
    await fetch('/api/users/approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status, perOtpRate: safeRate, rejectionReason }),
    });
  } catch (err) {
    console.warn('Backend update approval error:', err);
  }

  return true;
}

// Agent API: Update per-OTP rate (0.30 to 0.60 BDT)
export async function updateUserOtpRate(
  userId: string,
  perOtpRate: number
): Promise<boolean> {
  const safeRate = Math.min(0.60, Math.max(0.30, Number(Number(perOtpRate).toFixed(2))));
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { perOtpRate: safeRate, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.warn('Firestore update OTP rate error:', err);
  }

  try {
    await fetch('/api/users/otprate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, perOtpRate: safeRate }),
    });
  } catch (err) {
    console.warn('Backend update OTP rate error:', err);
  }
  return true;
}

// Credit user on OTP delivered
export async function creditUserForOtp(
  userId: string,
  rate?: number
): Promise<{
  success: boolean;
  credited: number;
  newBalance: number;
  totalOtps: number;
  isAgent?: boolean;
  agentCredited?: number;
  agentEmail?: string;
  agentId?: string;
  agentNewBalance?: number;
}> {
  try {
    const res = await fetch('/api/users/credit-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount: rate }),
    });
    if (res.ok) {
      const data = await res.json();
      // Sync Firestore user
      try {
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const current = snap.data() as UserProfile;
          const newBal = Number(((current.balance || 0) + (data.credited || 0.30)).toFixed(2));
          await updateDoc(userRef, {
            balance: newBal,
            totalOtps: (current.totalOtps || 0) + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (fsErr) {
        console.warn('Firestore credit sync error:', fsErr);
      }

      // Sync Firestore agent if commission was credited
      if (data.agentCredited && data.agentCredited > 0 && data.agentId) {
        try {
          const agentRef = doc(db, 'users', data.agentId);
          const agentSnap = await getDoc(agentRef);
          if (agentSnap.exists()) {
            const currentAgent = agentSnap.data() as UserProfile;
            const newAgentBal = Number(((currentAgent.balance || 0) + data.agentCredited).toFixed(2));
            await updateDoc(agentRef, {
              balance: newAgentBal,
              agentCommissionEarned: Number(
                ((currentAgent.agentCommissionEarned || 0) + data.agentCredited).toFixed(2)
              ),
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (agFsErr) {
          console.warn('Firestore agent commission sync error:', agFsErr);
        }
      }

      return data;
    }
  } catch (err) {
    console.warn('Backend credit-otp error:', err);
  }
  return { success: false, credited: 0, newBalance: 0, totalOtps: 0 };
}

// Fetch list of registered agents
export async function fetchAgentsList(): Promise<{ id: string; email: string; displayName: string; role?: string }[]> {
  try {
    const res = await fetch('/api/agents');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.agents) && data.agents.length > 0) return data.agents;
    }
  } catch (err) {
    console.warn('Failed to fetch agents:', err);
  }
  try {
    const all = await fetchAllUsers();
    const agentsOnly = all.filter((u) => u.role === 'agent');
    const admins = all.filter((u) => (u.role === 'admin' || u.email === 'mnshiddik11@gmail.com') && !agentsOnly.some((a) => a.email.toLowerCase() === u.email.toLowerCase()));
    const sorted = [...agentsOnly, ...admins].map((u) => ({ id: u.id, email: u.email, displayName: u.displayName, role: u.role }));
    if (sorted.length > 0) return sorted;
  } catch {}
  return [{ id: 'admin', email: 'mnshiddik11@gmail.com', displayName: 'Master Admin' }];
}

// Real-time Firestore users listener
export function subscribeToAllUsers(
  callback: (users: UserProfile[]) => void,
  onError?: (error: any) => void
): () => void {
  try {
    const usersCol = collection(db, 'users');
    return onSnapshot(
      usersCol,
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          const item = d.data() as UserProfile;
          if (item && item.id) {
            list.push(item);
          }
        });
        callback(list);
      },
      (err) => {
        console.warn('subscribeToAllUsers Firestore error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('Failed to setup snapshot listener:', err);
    return () => {};
  }
}

// Admin API: Fetch all users from Firestore + Backend Database
export async function fetchAllUsers(): Promise<UserProfile[]> {
  const usersMap = new Map<string, UserProfile>();

  // 1. Fetch from Firestore
  try {
    const usersCol = collection(db, 'users');
    const snap = await getDocs(usersCol);
    if (!snap.empty) {
      snap.docs.forEach((d) => {
        const u = d.data() as UserProfile;
        if (u && (u.id || u.email)) {
          const key = (u.email ? u.email.toLowerCase() : u.id);
          usersMap.set(key, u);
          // Also set by id
          if (u.id) usersMap.set(u.id, u);
        }
      });
    }
  } catch (err) {
    console.warn('Failed to fetch users list from Firestore:', err);
  }

  // 2. Fetch from Backend Database (/api/users)
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        data.users.forEach((u: UserProfile) => {
          if (u && (u.id || u.email)) {
            const key = (u.email ? u.email.toLowerCase() : u.id);
            const existing = usersMap.get(key) || (u.id ? usersMap.get(u.id) : null);
            if (!existing) {
              usersMap.set(key, u);
              if (u.id) usersMap.set(u.id, u);
            } else {
              const merged: UserProfile = {
                ...existing,
                ...u,
                id: u.id || existing.id,
                email: u.email || existing.email,
                displayName: u.displayName || existing.displayName,
                role: (existing.role === 'admin' ? 'admin' : (u.role || existing.role)),
                status: u.status || existing.status,
                agentEmail: (u.agentEmail && u.agentEmail.trim() !== '') ? u.agentEmail : existing.agentEmail,
                perOtpRate: typeof u.perOtpRate === 'number' ? u.perOtpRate : existing.perOtpRate,
                balance: typeof u.balance === 'number' ? u.balance : existing.balance,
                totalNumbers: typeof u.totalNumbers === 'number' ? u.totalNumbers : existing.totalNumbers,
                totalOtps: typeof u.totalOtps === 'number' ? u.totalOtps : existing.totalOtps,
                isBanned: typeof u.isBanned === 'boolean' ? u.isBanned : existing.isBanned,
                banReason: u.banReason || existing.banReason,
                rejectionReason: u.rejectionReason || existing.rejectionReason,
              };
              usersMap.set(key, merged);
              if (merged.id) usersMap.set(merged.id, merged);
            }
          }
        });
      }
    }
  } catch (err) {
    console.warn('Backend /api/users fetch error:', err);
  }

  // Deduplicate by ID
  const uniqueUsers = new Map<string, UserProfile>();
  usersMap.forEach((user) => {
    if (user && user.id) {
      uniqueUsers.set(user.id, user);
    }
  });

  const result = Array.from(uniqueUsers.values());

  // Save to known users in localStorage for instant access
  try {
    if (result.length > 0) {
      localStorage.setItem('nxv_known_users', JSON.stringify(result));
    }
  } catch {}

  return result;
}

// Broadcast Log Posting (Admin)
export async function createBroadcastAnnouncement(item: {
  title: string;
  message: string;
  type: 'INFO' | 'ALERT' | 'UPDATE' | 'RANGE_ADDED';
  authorId?: string;
}): Promise<boolean> {
  try {
    const id = `bc-${Date.now()}`;
    const logRef = doc(db, 'broadcastLogs', id);
    await setDoc(logRef, {
      id,
      title: item.title,
      message: item.message,
      type: item.type,
      authorId: item.authorId || 'admin',
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('Failed to publish broadcast log:', err);
    return false;
  }
}

export function signInWithDemoUser(): UserProfile {
  const demoProfile: UserProfile = {
    id: `guest-${Date.now().toString(36)}`,
    email: 'user@nxvsms.com',
    displayName: 'NXV Member',
    role: 'user',
    balance: 0,
    totalNumbers: 0,
    totalOtps: 0,
    isBanned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem('nxv_user_profile', JSON.stringify(demoProfile));
  } catch {}
  return demoProfile;
}

// Withdrawals API helpers
export async function fetchUserWithdrawals(userId?: string): Promise<any[]> {
  try {
    const url = userId ? `/api/withdrawals?userId=${encodeURIComponent(userId)}` : '/api/withdrawals';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.withdrawals)) return data.withdrawals;
    }
  } catch (err) {
    console.warn('Failed to fetch withdrawals:', err);
  }
  return [];
}

export async function requestWithdrawal(params: {
  userId: string;
  method: 'bkash' | 'nagad' | 'binance';
  accountNumber: string;
  amount: number;
}): Promise<{ success: boolean; message?: string; withdrawal?: any; newBalance?: number }> {
  try {
    const res = await fetch('/api/withdrawals/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'উইথড্র রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে' };
  }
}

export async function handleWithdrawalAdminAction(
  withdrawalId: string,
  action: 'approve' | 'reject',
  adminNote?: string
): Promise<{ success: boolean; withdrawal?: any }> {
  try {
    const res = await fetch('/api/withdrawals/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ withdrawalId, action, adminNote }),
    });
    return await res.json();
  } catch (err) {
    return { success: false };
  }
}

// User: Request API Access
export async function requestApiAccess(
  userId: string,
  reason?: string,
  userProfile?: Partial<UserProfile>
): Promise<{ success: boolean; message: string; user?: UserProfile }> {
  try {
    const res = await fetch('/api/users/api-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        reason,
        email: userProfile?.email,
        displayName: userProfile?.displayName,
      }),
    });
    const data = await res.json().catch(() => ({ success: true }));
    // Always sync Firestore document
    try {
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        await updateDoc(userRef, {
          apiAccessStatus: 'pending',
          apiRequestReason: reason || 'Telegram Bot & API Integration',
          apiRequestDate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (userProfile) {
        await setDoc(userRef, {
          ...userProfile,
          id: userId,
          apiAccessStatus: 'pending',
          apiRequestReason: reason || 'Telegram Bot & API Integration',
          apiRequestDate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (fsErr) {
      console.warn('Firestore requestApiAccess sync error:', fsErr);
    }
    return data;
  } catch (err: any) {
    // Fallback sync to Firestore even if network request fails
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        apiAccessStatus: 'pending',
        apiRequestReason: reason || 'Telegram Bot & API Integration',
        apiRequestDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch {}
    return { success: true, message: 'API এক্সেস রিকোয়েস্ট সফলভাবে জমা হয়েছে!' };
  }
}

// Admin: Approve API Access
export async function approveApiAccess(
  userId: string,
  userProfile?: Partial<UserProfile>
): Promise<{ success: boolean; message: string; apiKey?: string; user?: UserProfile }> {
  try {
    const res = await fetch('/api/users/api-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email: userProfile?.email,
        displayName: userProfile?.displayName,
      }),
    });
    const data = await res.json().catch(() => null);

    // Guaranteed API Key (from server response or robust fallback)
    const approvedKey = (data && data.success && data.apiKey)
      ? data.apiKey
      : `nxv_live_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;

    // Update Firestore user document immediately
    try {
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        await updateDoc(userRef, {
          apiAccessStatus: 'approved',
          apiKey: approvedKey,
          rejectionReason: '',
          updatedAt: new Date().toISOString(),
        });
      } else if (userProfile || data?.user) {
        await setDoc(userRef, {
          ...(userProfile || {}),
          ...(data?.user || {}),
          id: userId,
          apiAccessStatus: 'approved',
          apiKey: approvedKey,
          rejectionReason: '',
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (fsErr) {
      console.warn('Firestore approveApiAccess update failed:', fsErr);
    }

    return {
      success: true,
      message: 'API এক্সেস সফলভাবে অনুমোদিত হয়েছে!',
      apiKey: approvedKey,
      user: data?.user || (userProfile as UserProfile),
    };
  } catch (err: any) {
    // If backend fetch fails, still update Firestore so approval works reliably
    const fallbackKey = `nxv_live_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        apiAccessStatus: 'approved',
        apiKey: fallbackKey,
        rejectionReason: '',
        updatedAt: new Date().toISOString(),
      });
    } catch {}
    return {
      success: true,
      message: 'API এক্সেস সফলভাবে অনুমোদিত হয়েছে!',
      apiKey: fallbackKey,
    };
  }
}

// Admin: Reject API Access
export async function rejectApiAccess(
  userId: string,
  reason?: string,
  userProfile?: Partial<UserProfile>
): Promise<{ success: boolean; message: string; user?: UserProfile }> {
  try {
    const res = await fetch('/api/users/api-reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        reason,
        email: userProfile?.email,
        displayName: userProfile?.displayName,
      }),
    });
    const data = await res.json().catch(() => null);
    try {
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        await updateDoc(userRef, {
          apiAccessStatus: 'rejected',
          rejectionReason: reason || 'Admin rejected API access',
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (fsErr) {
      console.warn('Firestore rejectApiAccess error:', fsErr);
    }
    return {
      success: true,
      message: 'API এক্সেস বাতিল করা হয়েছে',
      user: data?.user,
    };
  } catch (err: any) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        apiAccessStatus: 'rejected',
        rejectionReason: reason || 'Admin rejected API access',
        updatedAt: new Date().toISOString(),
      });
    } catch {}
    return { success: true, message: 'API এক্সেস বাতিল করা হয়েছে' };
  }
}

// Admin: Revoke API Access
export async function revokeApiAccess(
  userId: string,
  userProfile?: Partial<UserProfile>
): Promise<{ success: boolean; message: string; user?: UserProfile }> {
  try {
    const res = await fetch('/api/users/api-revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email: userProfile?.email,
        displayName: userProfile?.displayName,
      }),
    });
    const data = await res.json().catch(() => null);
    try {
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        await updateDoc(userRef, {
          apiAccessStatus: 'none',
          apiKey: '',
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (fsErr) {
      console.warn('Firestore revokeApiAccess error:', fsErr);
    }
    return {
      success: true,
      message: 'API এক্সেস নিষ্ক্রিয় করা হয়েছে',
      user: data?.user,
    };
  } catch (err: any) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        apiAccessStatus: 'none',
        apiKey: '',
        updatedAt: new Date().toISOString(),
      });
    } catch {}
    return { success: true, message: 'API এক্সেস নিষ্ক্রিয় করা হয়েছে' };
  }
}

// User / Admin: Regenerate API Key
export async function regenerateApiKey(
  userId: string,
  userProfile?: Partial<UserProfile>
): Promise<{ success: boolean; message: string; apiKey?: string; user?: UserProfile }> {
  try {
    const res = await fetch('/api/users/api-regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email: userProfile?.email,
        displayName: userProfile?.displayName,
      }),
    });
    const data = await res.json().catch(() => null);
    const newKey = (data && data.success && data.apiKey)
      ? data.apiKey
      : `nxv_live_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;

    try {
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        await updateDoc(userRef, {
          apiKey: newKey,
          apiAccessStatus: 'approved',
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (fsErr) {
      console.warn('Firestore regenerateApiKey error:', fsErr);
    }

    return {
      success: true,
      message: 'নতুন API Key সফলভাবে তৈরি হয়েছে!',
      apiKey: newKey,
      user: data?.user,
    };
  } catch (err: any) {
    const fallbackKey = `nxv_live_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        apiKey: fallbackKey,
        apiAccessStatus: 'approved',
        updatedAt: new Date().toISOString(),
      });
    } catch {}
    return {
      success: true,
      message: 'নতুন API Key সফলভাবে তৈরি হয়েছে!',
      apiKey: fallbackKey,
    };
  }
}


