import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { GetNumberView } from './components/GetNumberView';
import { HistoryView } from './components/HistoryView';
import { ManageRangeView } from './components/ManageRangeView';
import { ConsoleView } from './components/ConsoleView';
import { ProfileView } from './components/ProfileView';
import { AdminPanelView } from './components/AdminPanelView';
import { AgentManagementView } from './components/AgentManagementView';
import { WithdrawView } from './components/WithdrawView';
import { AuthPage } from './components/AuthPage';
import { PendingApprovalView } from './components/PendingApprovalView';
import { RejectedAccountView } from './components/RejectedAccountView';
import { API } from './lib/api';
import { ActiveRange, SmsOrder, BroadcastItem, ConsoleLog } from './types';
import {
  auth,
  db,
  UserProfile,
  fetchOrCreateUserProfile,
  testConnection,
  creditUserForOtp,
  ensurePublicAgentsSeeded,
} from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { PhoneCall, History, Radio, Terminal, User, ShieldAlert, ShieldCheck, Clock, CheckCircle, XCircle, Wallet } from 'lucide-react';
import { detectCountryFromRange, normalizeServiceName } from './lib/countryUtils';

// User-scoped LocalStorage helpers to prevent cross-user leakage
const getUserOrdersKey = (uid: string) => `nxv_sms_orders_${uid}`;
const getUserActiveOrderKey = (uid: string) => `nxv_active_order_${uid}`;

const getStoredUserOrders = (uid: string): SmsOrder[] => {
  try {
    const saved = localStorage.getItem(getUserOrdersKey(uid));
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((o) => o && o.userId === uid);
      }
    }
  } catch {}
  return [];
};

const setStoredUserOrders = (uid: string, list: SmsOrder[]) => {
  try {
    const filtered = list.filter((o) => o && o.userId === uid);
    localStorage.setItem(getUserOrdersKey(uid), JSON.stringify(filtered));
  } catch {}
};

const getStoredUserActiveOrder = (uid: string): SmsOrder | null => {
  try {
    const saved = localStorage.getItem(getUserActiveOrderKey(uid));
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.userId === uid) return parsed;
    }
  } catch {}
  return null;
};

const setStoredUserActiveOrder = (uid: string, order: SmsOrder | null) => {
  try {
    if (order && order.userId === uid) {
      localStorage.setItem(getUserActiveOrderKey(uid), JSON.stringify(order));
    } else {
      localStorage.removeItem(getUserActiveOrderKey(uid));
    }
  } catch {}
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('getnum');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // User State: initialize from localStorage for instant, zero-flicker loading
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('nxv_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const profileRef = useRef<UserProfile | null>(userProfile);
  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  // User-isolated Orders State: Load ONLY this logged-in user's stored orders
  const [orders, setOrders] = useState<SmsOrder[]>(() => {
    try {
      const savedUser = localStorage.getItem('nxv_user_profile');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u && u.id) {
          return getStoredUserOrders(u.id);
        }
      }
    } catch {}
    return [];
  });

  // User-isolated Active Order State: Load ONLY this logged-in user's active order
  const [activeOrder, setActiveOrder] = useState<SmsOrder | null>(() => {
    try {
      const savedUser = localStorage.getItem('nxv_user_profile');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u && u.id) {
          return getStoredUserActiveOrder(u.id);
        }
      }
    } catch {}
    return null;
  });

  const [isSyncingOrders, setIsSyncingOrders] = useState<boolean>(false);

  const triggerImmediateSync = async () => {
    const curUid = profileRef.current?.id || userProfile?.id;
    if (!curUid) return;
    setIsSyncingOrders(true);
    try {
      const curApiKey = profileRef.current?.apiKey || userProfile?.apiKey || '';
      const curEmail = (profileRef.current?.email || userProfile?.email || '').toLowerCase();
      const ordersRes = await fetch(
        `/api/users/orders?userId=${encodeURIComponent(curUid)}&apiKey=${encodeURIComponent(curApiKey)}&email=${encodeURIComponent(curEmail)}`
      );
      if (ordersRes.ok) {
        const oJson = await ordersRes.json();
        if (oJson.success && Array.isArray(oJson.orders)) {
          const myServerOrders: SmsOrder[] = oJson.orders.filter((ord: any) => {
            return (
              ord &&
              ord.id &&
              (ord.userId === curUid ||
                (curApiKey && (ord.apiKey === curApiKey || ord.checkOtpUrl?.includes(curApiKey))) ||
                (curEmail && ord.userEmail && ord.userEmail.toLowerCase() === curEmail))
            );
          });

          if (myServerOrders.length > 0) {
            setOrders((prev) => {
              const map = new Map<string, SmsOrder>();
              prev.forEach((o) => map.set(o.id, o));
              myServerOrders.forEach((so) => {
                const existing = map.get(so.id);
                if (!existing || new Date(so.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
                  map.set(so.id, { ...existing, ...so, userId: curUid });
                }
              });
              const merged = Array.from(map.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              setStoredUserOrders(curUid, merged);
              return merged;
            });
          }
        }
      }
    } catch {} finally {
      setIsSyncingOrders(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      triggerImmediateSync();
    }
  }, [activeTab]);

  // Active Ranges
  const [ranges, setRanges] = useState<ActiveRange[]>([]);
  const [rangesLoading, setRangesLoading] = useState<boolean>(false);
  const [rangesSource, setRangesSource] = useState<string>('live');
  const [preselectedRange, setPreselectedRange] = useState<string>('');
  const [preselectedService, setPreselectedService] = useState<string>('');

  // Broadcasts & Logs
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [logs, setLogs] = useState<ConsoleLog[]>([
    {
      id: 'log-init-1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      endpoint: '/api/v1/routes',
      message: 'NXV SMS Panel connected to Live Carrier Gateway',
    },
  ]);

  const addLog = (log: Omit<ConsoleLog, 'id' | 'timestamp'>) => {
    setLogs((prev) => [
      ...prev,
      {
        ...log,
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  // Sync user profile to localStorage
  useEffect(() => {
    if (userProfile) {
      try {
        localStorage.setItem('nxv_user_profile', JSON.stringify(userProfile));
      } catch {}
    } else {
      try {
        localStorage.removeItem('nxv_user_profile');
      } catch {}
    }
  }, [userProfile]);

  // Sync orders strictly to current user's scoped storage
  useEffect(() => {
    if (userProfile?.id) {
      setStoredUserOrders(userProfile.id, orders);
    }
  }, [orders, userProfile?.id]);

  // Sync activeOrder strictly to current user's scoped storage
  useEffect(() => {
    if (userProfile?.id) {
      setStoredUserActiveOrder(userProfile.id, activeOrder);
    }
  }, [activeOrder, userProfile?.id]);

  // 1. Initial connection & data load + cleanup legacy non-scoped storage
  useEffect(() => {
    try {
      localStorage.removeItem('nxv_sms_orders');
      localStorage.removeItem('nxv_active_order');
    } catch {}

    testConnection().catch(() => {});
    ensurePublicAgentsSeeded().catch(() => {});
    loadActiveRanges();
    loadBroadcasts();
  }, []);

  // 2. Firebase Auth Listener & STRICT User Isolation for Firestore Orders
  useEffect(() => {
    let unsubOrders: (() => void) | null = null;
    let unsubApiOrders: (() => void) | null = null;
    let unsubProfile: (() => void) | null = null;
    let serverProfileTimer: any = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubOrders) {
        unsubOrders();
        unsubOrders = null;
      }
      if (unsubApiOrders) {
        unsubApiOrders();
        unsubApiOrders = null;
      }
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (serverProfileTimer) {
        clearInterval(serverProfileTimer);
        serverProfileTimer = null;
      }

      if (firebaseUser) {
        const uid = firebaseUser.uid;

        // Immediately load this specific user's cached numbers
        const userSavedOrders = getStoredUserOrders(uid);
        const userSavedActive = getStoredUserActiveOrder(uid);
        setOrders(userSavedOrders);
        if (userSavedActive) {
          const isExpired = Date.now() >= new Date(userSavedActive.expiresAt).getTime() || userSavedActive.status !== 'WAITING';
          if (isExpired) {
            setStoredUserActiveOrder(uid, null);
            setActiveOrder(null);
          } else {
            setActiveOrder(userSavedActive);
          }
        } else {
          setActiveOrder(null);
        }

        try {
          const userKey = firebaseUser.email?.toLowerCase().trim() || '';
          const pendingRaw = localStorage.getItem(`nxv_pending_user_${userKey}`);
          let pAgent: string | undefined;
          let pName: string | undefined;
          if (pendingRaw) {
            try {
              const parsed = JSON.parse(pendingRaw);
              pAgent = parsed.agentEmail;
              pName = parsed.displayName;
            } catch {}
          }

          const profile = await fetchOrCreateUserProfile(firebaseUser, pName, pAgent);
          if (profile.status === 'approved') {
            try {
              localStorage.removeItem(`nxv_pending_user_${userKey}`);
            } catch {}
          }
          setUserProfile(profile);
          addLog({
            type: 'success',
            message: `User signed in: ${profile.displayName} (${profile.email})`,
          });
        } catch {
          const isMaster = firebaseUser.email?.toLowerCase() === 'mnshiddik11@gmail.com';
          setUserProfile({
            id: uid,
            email: firebaseUser.email || 'user@nxvsms.com',
            displayName: firebaseUser.displayName || 'NXV User',
            role: isMaster ? 'admin' : 'user',
            balance: 0,
            totalNumbers: 0,
            totalOtps: 0,
            status: isMaster ? 'approved' : 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // Realtime listener for User Profile updates (API status, Key, Balance, Hits)
        const userDocRef = doc(db, 'users', uid);
        unsubProfile = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setUserProfile((prev) => {
              if (!prev) return data;
              // Guard: never let stale Firestore data clear out approved API status or apiKey!
              const effectiveApiKey = data.apiKey || prev.apiKey || '';
              const effectiveApiStatus =
                data.apiAccessStatus === 'approved' || prev.apiAccessStatus === 'approved'
                  ? 'approved'
                  : (data.apiAccessStatus || prev.apiAccessStatus || 'none');
              return {
                ...prev,
                ...data,
                apiKey: effectiveApiKey,
                apiAccessStatus: effectiveApiStatus,
                apiHits: typeof prev.apiHits === 'number' && (!data.apiHits || data.apiHits < prev.apiHits)
                  ? prev.apiHits
                  : (data.apiHits ?? prev.apiHits),
              };
            });
          }
        });

        // Fast periodic poll of backend user profile & orders to ensure immediate sync of admin API approvals & Telegram bot numbers
        const fetchServerProfile = async () => {
          try {
            const queryKey = encodeURIComponent(uid || firebaseUser.email || '');
            const res = await fetch(`/api/users/profile/${queryKey}`);
            if (res.ok) {
              const resJson = await res.json();
              if (resJson.success && resJson.user) {
                setUserProfile((prev) => {
                  if (!prev) return resJson.user;
                  return {
                    ...prev,
                    ...resJson.user,
                    apiKey: resJson.user.apiKey || prev.apiKey || '',
                    apiAccessStatus: resJson.user.apiAccessStatus || prev.apiAccessStatus || 'none',
                    apiHits: typeof resJson.user.apiHits === 'number' ? resJson.user.apiHits : prev.apiHits,
                  };
                });
              }
            }

            // Sync Telegram bot / external API orders into user's private Firestore subcollection & History
            const curApiKey = profileRef.current?.apiKey || '';
            const curEmail = (profileRef.current?.email || firebaseUser?.email || '').toLowerCase();
            const ordersRes = await fetch(
              `/api/users/orders?userId=${encodeURIComponent(uid)}&apiKey=${encodeURIComponent(curApiKey)}&email=${encodeURIComponent(curEmail)}`
            );
            if (ordersRes.ok) {
              const oJson = await ordersRes.json();
              if (oJson.success && Array.isArray(oJson.orders) && oJson.orders.length > 0) {
                const myServerOrders: SmsOrder[] = oJson.orders.filter((ord: any) => {
                  return (
                    ord &&
                    ord.id &&
                    (ord.userId === uid ||
                      (curApiKey && (ord.apiKey === curApiKey || ord.checkOtpUrl?.includes(curApiKey))) ||
                      (curEmail && ord.userEmail && ord.userEmail.toLowerCase() === curEmail))
                  );
                });

                if (myServerOrders.length > 0) {
                  // Direct state update so numbers appear in history and profile IMMEDIATELY
                  setOrders((prev) => {
                    const map = new Map<string, SmsOrder>();
                    prev.forEach((o) => map.set(o.id, o));
                    myServerOrders.forEach((so) => {
                      const existing = map.get(so.id);
                      if (!existing || new Date(so.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
                        map.set(so.id, { ...existing, ...so, userId: uid });
                      }
                    });
                    const merged = Array.from(map.values()).sort(
                      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    );
                    setStoredUserOrders(uid, merged);
                    return merged;
                  });

                  // If user has a waiting order from bot, update activeOrder
                  setActiveOrder((current) => {
                    if (!current || current.userId !== uid) {
                      const waitingOrder = myServerOrders.find(
                        (o) =>
                          o.status === 'WAITING' &&
                          o.expiresAt &&
                          Date.now() < new Date(o.expiresAt).getTime()
                      ) || null;
                      if (waitingOrder) {
                        setStoredUserActiveOrder(uid, waitingOrder);
                        return waitingOrder;
                      }
                    } else {
                      const updatedMatch = myServerOrders.find((o) => o.id === current.id);
                      if (updatedMatch) {
                        if (
                          updatedMatch.status !== 'WAITING' ||
                          (updatedMatch.expiresAt && Date.now() >= new Date(updatedMatch.expiresAt).getTime())
                        ) {
                          setStoredUserActiveOrder(uid, null);
                          return null;
                        }
                        return updatedMatch;
                      }
                    }
                    return current;
                  });

                  // Background sync to Firestore safely
                  for (const ord of myServerOrders) {
                    try {
                      const userOrderDoc = doc(db, 'users', uid, 'smsOrders', ord.id);
                      const safeFirestoreDoc: any = {
                        id: ord.id,
                        userId: uid,
                        phoneNumber: ord.phoneNumber,
                        service: ord.service || 'Telegram',
                        country: ord.country || 'UK (+44)',
                        range: ord.range || '',
                        status: ord.status,
                        source: ord.source || 'api',
                        createdAt: ord.createdAt,
                        updatedAt: ord.updatedAt || new Date().toISOString(),
                      };
                      if (ord.otpCode) safeFirestoreDoc.otpCode = ord.otpCode;
                      if (ord.fullMessage) safeFirestoreDoc.fullMessage = ord.fullMessage;
                      if (ord.expiresAt) safeFirestoreDoc.expiresAt = ord.expiresAt;
                      if (ord.credited !== undefined) safeFirestoreDoc.credited = ord.credited;
                      if (ord.earnedAmount !== undefined) safeFirestoreDoc.earnedAmount = ord.earnedAmount;
                      if (ord.price !== undefined) safeFirestoreDoc.price = ord.price;
                      if (ord.apiKey) safeFirestoreDoc.apiKey = ord.apiKey;
                      if (ord.userEmail) safeFirestoreDoc.userEmail = ord.userEmail;
                      if (ord.checkOtpUrl) safeFirestoreDoc.checkOtpUrl = ord.checkOtpUrl;

                      setDoc(userOrderDoc, safeFirestoreDoc, { merge: true }).catch(() => {});
                    } catch {}
                  }
                }
              }
            }
          } catch {}
        };
        fetchServerProfile();
        serverProfileTimer = setInterval(fetchServerProfile, 3000);

        // Real-time listener on public api_orders so Telegram bot numbers pop up immediately in web history
        const apiOrdersRef = collection(db, 'api_orders');
        unsubApiOrders = onSnapshot(
          apiOrdersRef,
          (snapshot) => {
            snapshot.forEach((d) => {
              const data = d.data() as SmsOrder;
              const myApiKey = profileRef.current?.apiKey || '';
              const myEmail = (profileRef.current?.email || firebaseUser.email || '').toLowerCase();
              if (
                data &&
                data.id &&
                (data.userId === uid ||
                  (myApiKey && data.apiKey === myApiKey) ||
                  (myEmail && data.userEmail && data.userEmail.toLowerCase() === myEmail))
              ) {
                const userOrderDoc = doc(db, 'users', uid, 'smsOrders', data.id);
                const orderData = {
                  ...data,
                  userId: uid,
                  userEmail: data.userEmail || myEmail,
                };
                setDoc(userOrderDoc, orderData, { merge: true }).catch(() => {});

                setOrders((prev) => {
                  const map = new Map<string, SmsOrder>();
                  prev.forEach((o) => map.set(o.id, o));
                  map.set(data.id, { ...map.get(data.id), ...orderData });
                  const merged = Array.from(map.values()).sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  );
                  setStoredUserOrders(uid, merged);
                  return merged;
                });
              }
            });
          },
          (err) => {
            console.warn('api_orders snapshot error:', err);
          }
        );

        // Strictly listen to THIS user's private subcollection in Firestore
        const ordersRef = collection(db, 'users', uid, 'smsOrders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        unsubOrders = onSnapshot(
          q,
          (snapshot) => {
            const fsItems: SmsOrder[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as SmsOrder;
              if (data && data.userId === uid) {
                fsItems.push(data);
              }
            });

            // Set state strictly to this authenticated user's orders, merging without wiping
            setOrders((prev) => {
              const map = new Map<string, SmsOrder>();
              prev.forEach((o) => map.set(o.id, o));
              fsItems.forEach((o) => {
                const existing = map.get(o.id);
                if (!existing || new Date(o.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
                  map.set(o.id, { ...existing, ...o });
                }
              });
              const merged = Array.from(map.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              setStoredUserOrders(uid, merged);
              return merged;
            });

            setActiveOrder((current) => {
              if (!current || current.userId !== uid) {
                const waitingOrder = fsItems.find(
                  (o) =>
                    o.status === 'WAITING' &&
                    o.expiresAt &&
                    Date.now() < new Date(o.expiresAt).getTime()
                ) || null;
                setStoredUserActiveOrder(uid, waitingOrder);
                return waitingOrder;
              }
              const updatedMatch = fsItems.find((o) => o.id === current.id);
              if (updatedMatch) {
                if (
                  updatedMatch.status !== 'WAITING' ||
                  (updatedMatch.expiresAt && Date.now() >= new Date(updatedMatch.expiresAt).getTime())
                ) {
                  setStoredUserActiveOrder(uid, null);
                  return null;
                }
                if (
                  updatedMatch.status === current.status &&
                  updatedMatch.otpCode === current.otpCode &&
                  updatedMatch.updatedAt === current.updatedAt
                ) {
                  return current;
                }
                setStoredUserActiveOrder(uid, updatedMatch);
                return updatedMatch;
              }
              return current;
            });
          },
          (err) => {
            console.warn('Orders listener error:', err);
          }
        );
      } else {
        // When logged out, reset state completely so no other user sees previous data
        setUserProfile(null);
        setOrders([]);
        setActiveOrder(null);
      }
    });

    return () => {
      unsubscribe();
      if (unsubOrders) unsubOrders();
      if (unsubApiOrders) unsubApiOrders();
      if (unsubProfile) unsubProfile();
      if (serverProfileTimer) clearInterval(serverProfileTimer);
    };
  }, []);

  // 10-Minute Auto-Expiry Checker for Active Order (cancels after 10 minutes whether cancelled manually or not)
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'WAITING' || !userProfile?.id) return;
    const uid = userProfile.id;

    const checkOrderExpiration = () => {
      const expiresAtMs = new Date(activeOrder.expiresAt).getTime();
      if (Date.now() >= expiresAtMs) {
        // 10 minutes exceeded! Auto-expire and cancel
        const now = new Date().toISOString();
        const expiredId = activeOrder.id;
        setActiveOrder(null);
        setStoredUserActiveOrder(uid, null);
        handleUpdateOrderInHistory(expiredId, {
          status: 'CANCELLED',
          updatedAt: now,
        });

        if (uid) {
          try {
            const orderDocRef = doc(db, 'users', uid, 'smsOrders', expiredId);
            updateDoc(orderDocRef, {
              status: 'CANCELLED',
              updatedAt: now,
            }).catch(() => {});
          } catch {}
        }

        addLog({
          type: 'warn',
          message: `নাম্বার মেয়াদ উত্তীর্ণ (Expired): ${activeOrder.phoneNumber} (১০ মিনিট পূর্ণ হওয়ায় অটো-ক্যানসেল)`,
        });
      }
    };

    checkOrderExpiration();
    const interval = setInterval(checkOrderExpiration, 1000);
    return () => clearInterval(interval);
  }, [activeOrder?.id, activeOrder?.expiresAt, activeOrder?.status, userProfile?.id]);

  // 3. CONTINUOUS BACKGROUND OTP SYNC FOR USER'S PENDING ORDERS ONLY
  // Polls live gateway only for phone numbers that THIS logged in user has requested!
  useEffect(() => {
    if (!userProfile?.id) return;
    const currentUserId = userProfile.id;

    const checkGatewayOtps = async () => {
      // Find orders belonging strictly to THIS USER that are currently WAITING for OTP
      const waitingOrders = orders.filter(
        (ord) => ord.userId === currentUserId && ord.status === 'WAITING'
      );

      // If user has no active orders waiting for OTP, skip polling
      if (waitingOrders.length === 0) return;

      try {
        const res = await API.getAllOtps();
        if (!res.success || !res.otps || res.otps.length === 0) return;

        // Match received OTPs ONLY against this user's existing WAITING orders
        setOrders((prevOrders) => {
          let modified = false;

          const updatedOrders = prevOrders.map((ord) => {
            if (ord.userId !== currentUserId || ord.status !== 'WAITING') {
              return ord;
            }

            const cleanTarget = ord.phoneNumber.replace(/[^0-9]/g, '');

            const match = res.otps.find((item) => {
              const itemNum = String(item.number || '').replace(/[^0-9]/g, '');
              return (
                itemNum &&
                (itemNum === cleanTarget ||
                  cleanTarget.endsWith(itemNum) ||
                  itemNum.endsWith(cleanTarget))
              );
            });

            if (match && !ord.credited) {
              modified = true;
              let code = match.otp;
              const matchCode = String(match.otp || '').match(/\b\d{4,8}\b/);
              if (matchCode) code = matchCode[0];

              const now = new Date().toISOString();
              const isAgent = userProfile.role === 'agent';
              const earnedRate = isAgent
                ? 0.50
                : (userProfile.perOtpRate && userProfile.perOtpRate >= 0.30
                    ? Math.min(0.60, userProfile.perOtpRate)
                    : 0.30);

              const updatedOrder: SmsOrder = {
                ...ord,
                status: 'RECEIVED',
                otpCode: code,
                fullMessage: match.otp,
                credited: true,
                earnedAmount: earnedRate,
                updatedAt: now,
              };

              setActiveOrder((curActive) => {
                if (curActive && curActive.id === ord.id) {
                  setStoredUserActiveOrder(currentUserId, updatedOrder);
                  return updatedOrder;
                }
                return curActive;
              });

              // Credit user balance immediately
              creditUserForOtp(currentUserId, earnedRate)
                .then((res) => {
                  if (res && res.newBalance !== undefined) {
                    setUserProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            balance: res.newBalance,
                            totalOtps: res.totalOtps || ((prev.totalOtps || 0) + 1),
                          }
                        : null
                    );
                  }
                })
                .catch((e) => console.warn('Credit OTP call error:', e));

              // Persist to user's private Firestore subcollection
              const orderDocRef = doc(db, 'users', currentUserId, 'smsOrders', ord.id);
              updateDoc(orderDocRef, {
                status: 'RECEIVED',
                otpCode: code,
                fullMessage: match.otp,
                credited: true,
                earnedAmount: earnedRate,
                updatedAt: now,
              }).catch(() => {});

              addLog({
                type: 'success',
                endpoint: 'GET /v1/numsuccess/info',
                message: isAgent
                  ? `OTP delivered: ${code} for ${ord.phoneNumber} | এজেন্ট একাউন্ট আয়: ৳০.৫০ (৫০ পয়সা/OTP) ব্যালেন্সে যুক্ত হয়েছে`
                  : `OTP delivered: ${code} for ${ord.phoneNumber} | আপনার ব্যালেন্সে যোগ হয়েছে ৳${earnedRate.toFixed(2)} (রেট: ৳${earnedRate.toFixed(2)}/OTP)`,
              });

              return updatedOrder;
            }

            return ord;
          });

          if (modified) {
            setStoredUserOrders(currentUserId, updatedOrders);
            return updatedOrders;
          }

          return prevOrders;
        });
      } catch {
        // silent background check
      }
    };

    const interval = setInterval(checkGatewayOtps, 3000);
    return () => clearInterval(interval);
  }, [userProfile?.id, orders]);

  // Load active ranges directly from API
  const loadActiveRanges = async () => {
    setRangesLoading(true);
    const res = await API.getActiveRanges();
    if (res.ranges.length > 0) {
      setRanges(res.ranges);
      setRangesSource('Live Routing Matrix');
    }
    setRangesLoading(false);
    addLog({
      type: res.success ? 'success' : 'info',
      endpoint: 'GET /v1/active-ranges',
      message: res.success
        ? `Loaded ${res.ranges.length} active routes from carrier network`
        : `Active routes: ${res.message || 'Status verified'}`,
    });
  };

  // Load broadcasts
  const loadBroadcasts = async () => {
    const res = await API.getGlobalBroadcast();
    setBroadcasts(res.broadcasts);
    addLog({
      type: 'info',
      endpoint: 'GET /api/v1/global-broadcast',
      message: `Loaded ${res.broadcasts.length} live broadcast messages`,
    });
  };

  const handleAddOrderToHistory = (order: SmsOrder) => {
    if (!userProfile?.id) return;
    const uid = userProfile.id;
    const userOrder: SmsOrder = { ...order, userId: uid };

    setActiveOrder(userOrder);
    setOrders((prev) => {
      const updated = [userOrder, ...prev.filter((o) => o.id !== userOrder.id && o.userId === uid)];
      setStoredUserOrders(uid, updated);
      setStoredUserActiveOrder(uid, userOrder);
      return updated;
    });

    addLog({
      type: 'success',
      endpoint: 'POST /v1/getnum',
      message: `Allocated: ${userOrder.phoneNumber} for ${userOrder.service}`,
    });
  };

  const handleUpdateOrderInHistory = (orderId: string, updates: Partial<SmsOrder>) => {
    if (!userProfile?.id) return;
    const uid = userProfile.id;

    let alreadyCredited = false;
    const isAgent = userProfile.role === 'agent';
    const earnedRate = isAgent
      ? 0.50
      : (userProfile.perOtpRate && userProfile.perOtpRate >= 0.30
          ? Math.min(0.60, userProfile.perOtpRate)
          : 0.30);

    setOrders((prev) => {
      const updated = prev.map((o) => {
        if (o.id === orderId && o.userId === uid) {
          if (o.credited) {
            alreadyCredited = true;
          }
          const willCredit = updates.status === 'RECEIVED' && updates.otpCode && !o.credited;
          return {
            ...o,
            ...updates,
            ...(willCredit ? { credited: true, earnedAmount: earnedRate } : {}),
          };
        }
        return o;
      });
      setStoredUserOrders(uid, updated);
      return updated;
    });

    setActiveOrder((cur) => {
      if (cur && cur.id === orderId && cur.userId === uid) {
        if (updates.status === 'CANCELLED' || updates.status === 'EXPIRED') {
          setStoredUserActiveOrder(uid, null);
          return null;
        }
        const next = { ...cur, ...updates };
        setStoredUserActiveOrder(uid, next);
        return next;
      }
      return cur;
    });

    if (updates.status === 'RECEIVED' && updates.otpCode && !alreadyCredited) {
      creditUserForOtp(uid, earnedRate)
        .then((res) => {
          if (res && res.newBalance !== undefined) {
            setUserProfile((prev) =>
              prev
                ? {
                    ...prev,
                    balance: res.newBalance,
                    totalOtps: res.totalOtps || ((prev.totalOtps || 0) + 1),
                  }
                : null
            );
          }
        })
        .catch((e) => console.warn('Credit OTP call error:', e));

      addLog({
        type: 'success',
        endpoint: 'GET /v1/numsuccess/info',
        message: isAgent
          ? `OTP delivered: ${updates.otpCode} for order ${orderId} | এজেন্ট একাউন্ট আয়: ৳০.৫০ (৫০ পয়সা/OTP) ব্যালেন্সে যুক্ত হয়েছে`
          : `OTP delivered: ${updates.otpCode} for order ${orderId} | আপনার ব্যালেন্সে যোগ হয়েছে ৳${earnedRate.toFixed(2)} (রেট: ৳${earnedRate.toFixed(2)}/OTP)`,
      });
    }
  };

  const handleSelectRangeFromList = (range: string, service?: string) => {
    setPreselectedRange(range);
    if (service) {
      setPreselectedService(service);
    }
    setActiveTab('getnum');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {}
    setUserProfile(null);
    setOrders([]);
    setActiveOrder(null);
    try {
      localStorage.removeItem('nxv_user_profile');
      localStorage.removeItem('nxv_sms_orders');
      localStorage.removeItem('nxv_active_order');
    } catch {}
    addLog({ type: 'info', message: 'User signed out' });
  };

  // If not signed in, show Auth Page
  if (!userProfile) {
    return (
      <AuthPage
        onSuccess={(profile) => {
          if (profile.role !== 'admin' && profile.status === 'pending') {
            return;
          }
          setUserProfile(profile);
          addLog({
            type: 'success',
            message: `Signed in as ${profile.displayName}`,
          });
        }}
      />
    );
  }

  // Strict Protection: If account is pending, completely BLOCK dashboard and all actions
  if (userProfile.status === 'pending' && userProfile.role !== 'admin') {
    return (
      <PendingApprovalView
        userProfile={userProfile}
        onLogout={handleLogout}
        onApproved={(updatedProfile) => {
          setUserProfile(updatedProfile);
          addLog({
            type: 'success',
            message: `Account approved by agent! Per OTP rate: ৳${(updatedProfile.perOtpRate || 0.30).toFixed(2)}`,
          });
        }}
      />
    );
  }

  // If account is rejected, completely block dashboard
  if (userProfile.status === 'rejected' && userProfile.role !== 'admin') {
    return (
      <RejectedAccountView
        userProfile={userProfile}
        onLogout={handleLogout}
      />
    );
  }

  const otpsCount = Math.max(
    orders.filter((o) => o.status === 'RECEIVED').length,
    userProfile.totalOtps || 0
  );
  const totalNumbersCount = Math.max(orders.length, userProfile.totalNumbers || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation */}
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen(true)}
        userProfile={userProfile}
        onLogout={handleLogout}
        onSelectTab={setActiveTab}
      />

      {/* Drawer Navigation */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        userProfile={userProfile}
        onLogout={handleLogout}
        ordersCount={totalNumbersCount}
      />

      {/* Status Notice Banners */}
      {userProfile.status === 'pending' && userProfile.role !== 'admin' && (
        <div className="mx-auto max-w-7xl px-3.5 pt-3 sm:px-6">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 backdrop-blur-md shadow-lg shadow-amber-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Clock className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">আপনার অ্যাকাউন্ট অনুমোদনের অপেক্ষায় রয়েছে (Pending Approval)</span>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                    অপেক্ষমান
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 mt-0.5">
                  আপনার নির্বাচিত এজেন্ট <strong className="text-white font-mono">{userProfile.agentEmail || 'Agent'}</strong> এটি অনুমোদন করলে এবং প্রতি ওটিপি রেট (৳০.৩০ - ৳০.৬০) নির্ধারণ করলে আপনি ভার্চুয়াল নাম্বার গ্রহণ ও ওটিপি ইনকাম শুরু করতে পারবেন।
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono text-amber-300/90 self-end sm:self-auto bg-amber-900/40 px-3 py-1 rounded-lg border border-amber-700/50">
              STATUS: PENDING
            </div>
          </div>
        </div>
      )}

      {userProfile.status === 'rejected' && (
        <div className="mx-auto max-w-7xl px-3.5 pt-3 sm:px-6">
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 backdrop-blur-md shadow-lg shadow-rose-950/40 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">আপনার অ্যাকাউন্টটি বাতিল (Rejected) করা হয়েছে</span>
              <p className="text-xs text-rose-200/90 mt-0.5">
                {userProfile.rejectionReason || 'আপনার আবেদনটি এজেন্টের দ্বারা বাতিল করা হয়েছে।'} অনুগ্রহ করে আপনার এজেন্টের সাথে যোগাযোগ করুন।
              </p>
            </div>
          </div>
        </div>
      )}

      {userProfile.status === 'approved' && userProfile.role === 'user' && (
        <div className="mx-auto max-w-7xl px-3.5 pt-3 sm:px-6">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>অ্যাকাউন্ট অনুমোদিত! প্রতি ওটিপি প্রাপ্তিতে আপনার আয়: <strong className="text-white font-mono">৳{(userProfile.perOtpRate || 0.30).toFixed(2)}</strong></span>
            </div>
            {userProfile.agentEmail && (
              <span className="text-[11px] text-slate-400">
                এজেন্ট: <span className="font-mono text-emerald-400 font-bold">{userProfile.agentEmail}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area with safe mobile bottom padding */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8 pb-24 md:pb-8">
        {activeTab === 'getnum' && (
          <GetNumberView
            userProfile={userProfile}
            activeOrder={activeOrder}
            setActiveOrder={setActiveOrder}
            recentOrders={orders}
            onAddOrderToHistory={handleAddOrderToHistory}
            onUpdateOrderInHistory={handleUpdateOrderInHistory}
            activeRanges={ranges}
            preselectedRange={preselectedRange}
            preselectedService={preselectedService}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            orders={orders}
            onSelectGetNumber={() => setActiveTab('getnum')}
            onRefresh={triggerImmediateSync}
            isRefreshing={isSyncingOrders}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            userProfile={userProfile}
            onLogout={handleLogout}
            ordersCount={totalNumbersCount}
            otpsCount={otpsCount}
            onOpenAdmin={() => setActiveTab('admin')}
            onOpenAgentUsers={() => setActiveTab('agent-users')}
            onOpenWithdraw={() => setActiveTab('withdraw')}
            onUpdateProfile={(updated) => {
              setUserProfile((prev) => (prev ? { ...prev, ...updated } : null));
            }}
          />
        )}

        {activeTab === 'withdraw' && (
          <WithdrawView
            userProfile={userProfile}
            onBalanceUpdated={(newBal) => {
              setUserProfile((prev) => (prev ? { ...prev, balance: newBal } : null));
            }}
            onLogAction={(message, type) => addLog({ message, type: type || 'info' })}
          />
        )}

        {activeTab === 'agent-users' && (userProfile.role === 'agent' || userProfile.role === 'admin' || userProfile.email === 'mnshiddik11@gmail.com' || userProfile.email.toLowerCase().includes('agent')) && (
          <AgentManagementView
            currentAgent={userProfile}
            onLogAction={(message, type) => addLog({ message, type: type || 'info' })}
          />
        )}

        {activeTab === 'admin' && (userProfile.role === 'admin' || userProfile.email === 'mnshiddik11@gmail.com') && (
          <AdminPanelView
            currentUser={userProfile}
            onRefreshBroadcasts={loadBroadcasts}
            onLogAction={(message, type) => addLog({ message, type: type || 'info' })}
          />
        )}

        {activeTab === 'ranges' && (
          <ManageRangeView
            ranges={ranges}
            loading={rangesLoading}
            onRefresh={loadActiveRanges}
            onSelectRange={handleSelectRangeFromList}
            apiSource={rangesSource}
          />
        )}

        {activeTab === 'console' && (
          <ConsoleView
            broadcasts={broadcasts}
            onRefreshBroadcasts={loadBroadcasts}
            logs={logs}
            onAddLog={addLog}
          />
        )}
      </main>

      {/* Mobile Bottom Quick-Nav Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-cyan-500/20 bg-slate-950/95 backdrop-blur-xl px-2 py-1.5 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActiveTab('getnum')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
            activeTab === 'getnum' ? 'text-cyan-400 font-bold scale-105' : 'text-slate-400'
          }`}
        >
          <PhoneCall className="h-4 w-4" />
          <span className="text-[10px]">Get Number</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-xl relative transition-all ${
            activeTab === 'history' ? 'text-amber-400 font-bold scale-105' : 'text-slate-400'
          }`}
        >
          <History className="h-4 w-4" />
          <span className="text-[10px]">History</span>
          {orders.length > 0 && (
            <span className="absolute top-0 right-1 h-3.5 w-3.5 rounded-full bg-amber-500 text-[8px] font-black text-black flex items-center justify-center">
              {orders.length}
            </span>
          )}
        </button>

        {(userProfile.role === 'agent' || userProfile.role === 'admin' || userProfile.email === 'mnshiddik11@gmail.com') && (
          <button
            onClick={() => setActiveTab('agent-users')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
              activeTab === 'agent-users' ? 'text-emerald-400 font-bold scale-105' : 'text-slate-400'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[10px]">ইউজার</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('ranges')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
            activeTab === 'ranges' ? 'text-emerald-400 font-bold scale-105' : 'text-slate-400'
          }`}
        >
          <Radio className="h-4 w-4" />
          <span className="text-[10px]">Ranges</span>
        </button>

        <button
          onClick={() => setActiveTab('console')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
            activeTab === 'console' ? 'text-rose-400 font-bold scale-105' : 'text-slate-400'
          }`}
        >
          <Terminal className="h-4 w-4" />
          <span className="text-[10px]">Live Feed</span>
        </button>

        {(userProfile.role === 'admin' || userProfile.email === 'mnshiddik11@gmail.com') && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
              activeTab === 'admin' ? 'text-red-400 font-bold scale-105' : 'text-slate-400'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span className="text-[10px]">Admin</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
            activeTab === 'profile' ? 'text-violet-400 font-bold scale-105' : 'text-slate-400'
          }`}
        >
          <User className="h-4 w-4" />
          <span className="text-[10px]">Profile</span>
        </button>
      </div>
    </div>
  );
}
