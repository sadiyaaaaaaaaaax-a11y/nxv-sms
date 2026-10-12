import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  PhoneCall,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  XCircle,
  Server,
  Flame,
  Share2,
  Instagram,
  MessageSquare,
  Send,
  Mail,
  Cpu,
  Smartphone,
  Search,
  CheckCircle2,
  Clock,
  PlusCircle,
  History,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import { API } from '../lib/api';
import { SmsOrder, ActiveRange } from '../types';
import { UserProfile, db } from '../lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { detectCountryFromRange, normalizeServiceName } from '../lib/countryUtils';

interface GetNumberViewProps {
  userProfile: UserProfile | null;
  activeOrder: SmsOrder | null;
  setActiveOrder: (order: SmsOrder | null) => void;
  recentOrders: SmsOrder[];
  onAddOrderToHistory: (order: SmsOrder) => void;
  onUpdateOrderInHistory: (orderId: string, updates: Partial<SmsOrder>) => void;
  activeRanges: ActiveRange[];
  preselectedRange?: string;
  preselectedService?: string;
}

interface ServiceGroup {
  key: string;
  displayName: string;
  ranges: ActiveRange[];
  totalHits: number;
}

export const GetNumberView: React.FC<GetNumberViewProps> = ({
  userProfile,
  activeOrder,
  setActiveOrder,
  recentOrders,
  onAddOrderToHistory,
  onUpdateOrderInHistory,
  activeRanges,
  preselectedRange,
  preselectedService,
}) => {
  // Extract and group available services dynamically ONLY from live panel active ranges
  const serviceGroups = useMemo<ServiceGroup[]>(() => {
    if (!activeRanges || activeRanges.length === 0) return [];

    const map = new Map<string, { displayName: string; ranges: ActiveRange[]; totalHits: number }>();

    activeRanges.forEach((item) => {
      const norm = normalizeServiceName(item.service);
      const existing = map.get(norm.key) || {
        displayName: norm.displayName,
        ranges: [],
        totalHits: 0,
      };

      existing.ranges.push(item);
      existing.totalHits += item.hits || 0;
      map.set(norm.key, existing);
    });

    // Sort each group's ranges by hits descending
    const groups: ServiceGroup[] = Array.from(map.entries()).map(([key, data]) => {
      const sortedRanges = [...data.ranges].sort((a, b) => (b.hits || 0) - (a.hits || 0));
      return {
        key,
        displayName: data.displayName,
        ranges: sortedRanges,
        totalHits: data.totalHits,
      };
    });

    // Sort service groups by total hits descending
    return groups.sort((a, b) => b.totalHits - a.totalHits);
  }, [activeRanges]);

  const [selectedServiceKey, setSelectedServiceKey] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<string>('');
  const [rangeSearch, setRangeSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [manualChecking, setManualChecking] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(600);

  // Copy feedback states
  const [copiedNumber, setCopiedNumber] = useState<boolean>(false);
  const [copiedOtp, setCopiedOtp] = useState<boolean>(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  // Auto-select initial service and range
  useEffect(() => {
    if (serviceGroups.length === 0) return;

    if (preselectedService) {
      const normPre = normalizeServiceName(preselectedService).key;
      const found = serviceGroups.find((g) => g.key === normPre);
      if (found) {
        setSelectedServiceKey(found.key);
        if (preselectedRange) {
          setSelectedRange(preselectedRange);
        } else if (found.ranges.length > 0) {
          setSelectedRange(found.ranges[0].range);
        }
        return;
      }
    }

    if (preselectedRange) {
      const matchingGroup = serviceGroups.find((g) =>
        g.ranges.some((r) => r.range === preselectedRange)
      );
      if (matchingGroup) {
        setSelectedServiceKey(matchingGroup.key);
        setSelectedRange(preselectedRange);
        return;
      }
    }

    const currentGroup = serviceGroups.find((g) => g.key === selectedServiceKey);
    if (!currentGroup) {
      const topGroup = serviceGroups[0];
      setSelectedServiceKey(topGroup.key);
      if (topGroup.ranges.length > 0) {
        setSelectedRange(topGroup.ranges[0].range);
      }
    }
  }, [serviceGroups, preselectedRange, preselectedService, selectedServiceKey]);

  // Selected Service Group Object
  const currentServiceGroup = useMemo(() => {
    return serviceGroups.find((g) => g.key === selectedServiceKey) || serviceGroups[0];
  }, [serviceGroups, selectedServiceKey]);

  // Handle service selection change
  const handleSelectService = (groupKey: string) => {
    setSelectedServiceKey(groupKey);
    setErrorMsg(null);
    setRangeSearch('');

    const targetGroup = serviceGroups.find((g) => g.key === groupKey);
    if (targetGroup && targetGroup.ranges.length > 0) {
      setSelectedRange(targetGroup.ranges[0].range);
    }
  };

  // Filter ranges for current service based on search
  const displayedRanges = useMemo(() => {
    if (!currentServiceGroup) return [];
    if (!rangeSearch.trim()) return currentServiceGroup.ranges;

    const q = rangeSearch.toLowerCase().trim();
    return currentServiceGroup.ranges.filter((r) => {
      const country = detectCountryFromRange(r.range);
      return (
        r.range.toLowerCase().includes(q) ||
        (r.tag && r.tag.toLowerCase().includes(q)) ||
        country.name.toLowerCase().includes(q)
      );
    });
  }, [currentServiceGroup, rangeSearch]);

  // Clean polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Poll for incoming OTP while activeOrder is WAITING and belongs to this user
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'WAITING' || (userProfile && activeOrder.userId !== userProfile.id)) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const checkNow = async () => {
      try {
        const check = await API.checkOtp(activeOrder.phoneNumber);

        if (check.success && check.found && check.otp) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

          const updated: SmsOrder = {
            ...activeOrder,
            status: 'RECEIVED',
            otpCode: check.otp,
            fullMessage: check.fullMessage || `OTP: ${check.otp}`,
            updatedAt: new Date().toISOString(),
          };

          setActiveOrder(updated);
          onUpdateOrderInHistory(activeOrder.id, {
            status: 'RECEIVED',
            otpCode: check.otp,
            fullMessage: check.fullMessage,
            updatedAt: updated.updatedAt,
          });

          // Sync with Firestore
          if (userProfile?.id) {
            try {
              const orderDocRef = doc(db, 'users', userProfile.id, 'smsOrders', activeOrder.id);
              await updateDoc(orderDocRef, {
                status: 'RECEIVED',
                otpCode: check.otp,
                fullMessage: check.fullMessage,
                updatedAt: updated.updatedAt,
              });
            } catch (err) {
              console.warn('Firestore update error:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error polling OTP:', err);
      }
    };

    // Immediate check
    checkNow();

    pollIntervalRef.current = setInterval(checkNow, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeOrder?.phoneNumber, activeOrder?.status]);

  // Manual Check Now button
  const handleManualCheckOtp = async () => {
    if (!activeOrder) return;
    setManualChecking(true);
    try {
      const check = await API.checkOtp(activeOrder.phoneNumber);
      if (check.success && check.found && check.otp) {
        const updated: SmsOrder = {
          ...activeOrder,
          status: 'RECEIVED',
          otpCode: check.otp,
          fullMessage: check.fullMessage || `OTP: ${check.otp}`,
          updatedAt: new Date().toISOString(),
        };
        setActiveOrder(updated);
        onUpdateOrderInHistory(activeOrder.id, {
          status: 'RECEIVED',
          otpCode: check.otp,
          fullMessage: check.fullMessage,
          updatedAt: updated.updatedAt,
        });
      }
    } catch (err) {
      console.warn('Manual check error:', err);
    } finally {
      setTimeout(() => setManualChecking(false), 500);
    }
  };

  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const updated: SmsOrder = {
      ...activeOrder,
      status: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    };
    setActiveOrder(null);
    onUpdateOrderInHistory(activeOrder.id, { status: 'CANCELLED' });

    if (userProfile?.id) {
      try {
        const orderDocRef = doc(db, 'users', userProfile.id, 'smsOrders', activeOrder.id);
        await updateDoc(orderDocRef, {
          status: 'CANCELLED',
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Firestore cancel error:', err);
      }
    }
  };

  // Live countdown for active waiting order
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'WAITING') {
      setTimeLeft(600);
      return;
    }

    const checkTimer = () => {
      const expiresAtMs = new Date(activeOrder.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setTimeLeft((prev) => (prev !== remaining ? remaining : prev));

      // If 10 minutes elapsed, cancel order
      if (remaining <= 0) {
        handleCancelOrder();
      }
    };

    checkTimer();
    const timerInterval = setInterval(checkTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [activeOrder?.id, activeOrder?.expiresAt, activeOrder?.status]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  // Direct Number Request
  const handleGetNumber = async () => {
    setErrorMsg(null);

    if (userProfile?.isBanned) {
      setErrorMsg('আপনার অ্যাকাউন্ট এডমিন কর্তৃক স্থগিত / ব্যান রয়েছে। নতুন নাম্বার গ্রহণ করা সম্ভব নয়।');
      return;
    }

    if (userProfile?.status === 'pending' && userProfile?.role !== 'admin') {
      setErrorMsg(`আপনার অ্যাকাউন্টটি এখনও অনুমোদিত হয়নি। এজেন্ট (${userProfile?.agentEmail || 'Agent'}) অনুমোদন করার পর নাম্বার ও ওটিপি রিসিভ করে টাকা আয় করতে পারবেন।`);
      return;
    }

    if (userProfile?.status === 'rejected') {
      setErrorMsg('আপনার অ্যাকাউন্টটি এজেন্ট কর্তৃক বাতিল (Rejected) করা হয়েছে। অনুগ্রহ করে এজেন্টের সাথে যোগাযোগ করুন।');
      return;
    }

    const targetRange = selectedRange || (currentServiceGroup?.ranges[0]?.range) || '237627XXX';
    const serviceName = currentServiceGroup?.displayName || 'SMS';

    setLoading(true);

    try {
      const res = await API.getNumber({
        range: targetRange,
        service: currentServiceGroup?.key || 'general',
      });

      if (!res.success || !res.number) {
        setErrorMsg(
          res.message || 'নাম্বার পাওয়া যায়নি। দয়া করে তালিকা থেকে অন্য একটি রেঞ্জ নির্বাচন করে চেষ্টা করুন।'
        );
        setLoading(false);
        return;
      }

      const countryInfo = detectCountryFromRange(targetRange);

      const newOrder: SmsOrder = {
        id: res.orderId || `ORD-${Date.now()}`,
        userId: userProfile?.id || 'user',
        phoneNumber: res.number,
        service: serviceName,
        country: res.country || `${countryInfo.flag} ${countryInfo.name}`,
        range: targetRange,
        price: 0,
        status: 'WAITING',
        expiresAt: new Date(Date.now() + 600 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Set activeOrder persistently
      setActiveOrder(newOrder);
      onAddOrderToHistory(newOrder);

      // Save to Firestore
      if (userProfile?.id) {
        try {
          const orderDocRef = doc(db, 'users', userProfile.id, 'smsOrders', newOrder.id);
          await setDoc(orderDocRef, newOrder);
        } catch (fsErr) {
          console.warn('Could not save order to Firestore:', fsErr);
        }
      }

      // Scroll to top to see number immediately
      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'সার্ভার সংযোগে সমস্যা হয়েছে, পুনরায় চেষ্টা করুন');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'number' | 'otp') => {
    navigator.clipboard.writeText(text);
    if (type === 'number') {
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 2000);
    } else {
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  const getServiceIcon = (key: string) => {
    if (key.includes('facebook') || key.includes('fb')) return <Share2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />;
    if (key.includes('instagram') || key.includes('ig')) return <Instagram className="h-4 w-4 sm:h-5 sm:w-5 text-pink-400" />;
    if (key.includes('whatsapp') || key.includes('wa')) return <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />;
    if (key.includes('telegram') || key.includes('tg')) return <Send className="h-4 w-4 sm:h-5 sm:w-5 text-sky-400" />;
    if (key.includes('google') || key.includes('gmail')) return <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />;
    if (key.includes('discord')) return <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-400" />;
    if (key.includes('auth') || key.includes('sms')) return <Cpu className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />;
    return <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />;
  };

  const selectedRangeCountry = detectCountryFromRange(selectedRange);

  return (
    <div ref={topRef} className="space-y-4 sm:space-y-6">
      {/* Account Banned Warning Banner */}
      {userProfile?.isBanned && (
        <div className="rounded-2xl border-2 border-red-500/70 bg-red-950/80 p-4 sm:p-5 backdrop-blur-md text-red-200 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/30 border border-red-500/50 text-red-300 shrink-0">
              <Ban className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-red-100">
                অ্যাকাউন্ট স্থগিত / ব্যান করা হয়েছে (Account Suspended)
              </h3>
              <p className="text-xs text-red-300 mt-0.5">
                এডমিন কর্তৃক আপনার অ্যাকাউন্টে নতুন ভার্চুয়াল নাম্বার সংগ্রহ স্থগিত রাখা হয়েছে। সহায়তা পেতে এডমিনের সাথে যোগাযোগ করুন।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Agent Account Active Indicator */}
      {userProfile?.role === 'agent' && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">
              এজেন্ট সুবিধা সক্রিয়: পাইকারি ডিসকাউন্ট রেট এবং প্রায়োরিটি ওটিপি রুট সক্রিয় রয়েছে।
            </span>
          </div>
          <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-300 border border-emerald-500/30">
            Agent Mode
          </span>
        </div>
      )}

      {/* 1. TOP SECTION: ACTIVE NUMBER & LIVE OTP CARD (PERSISTS ON REFRESH FOR LOGGED IN OWNER ONLY) */}
      {activeOrder && (!userProfile || activeOrder.userId === userProfile.id) && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-4 sm:p-6 shadow-2xl shadow-emerald-950/60 backdrop-blur-md animate-in fade-in">
          {/* Card Top Meta Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 sm:pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-lg bg-cyan-500/20 px-2.5 py-1 text-xs font-black text-cyan-300 border border-cyan-500/30 uppercase flex items-center gap-1.5">
                {getServiceIcon(activeOrder.service.toLowerCase())}
                <span>{activeOrder.service}</span>
              </span>

              <span className="rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs text-slate-200 font-medium border border-slate-700">
                {activeOrder.country}
              </span>

              <span className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] text-cyan-300 font-mono border border-slate-800">
                রুট: {activeOrder.range}
              </span>

              {activeOrder.status === 'WAITING' ? (
                <>
                  <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>ওটিপির অপেক্ষায়</span>
                  </span>
                  <span className="rounded-lg bg-red-500/20 px-2.5 py-1 text-xs text-red-300 font-mono font-bold border border-red-500/30 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-red-400" />
                    <span>মেয়াদ বাকি: {formatCountdown(timeLeft)}</span>
                  </span>
                </>
              ) : (
                <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-300 font-extrabold border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>ওটিপি প্রাপ্ত হয়েছে (Received)</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                title="নতুন নাম্বারের জন্য ফর্ম খুলুন"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>নতুন নাম্বার নিন</span>
              </button>

              {activeOrder.status === 'WAITING' && (
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-950/60 transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5 inline mr-1" />
                  <span>বাতিল</span>
                </button>
              )}
            </div>
          </div>

          {/* Large Phone Number Display */}
          <div className="my-3 sm:my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-3.5 sm:p-4 rounded-xl border border-slate-800/80">
            <div>
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
                <span>বরাদ্দকৃত ভার্চুয়াল নাম্বার (Your Virtual Number):</span>
              </div>
              <div className="text-2xl sm:text-4xl font-black tracking-wider text-white select-all font-mono break-all text-shadow">
                {activeOrder.phoneNumber}
              </div>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(activeOrder.phoneNumber, 'number')}
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600/30 border border-cyan-400/40 px-4 py-2.5 text-xs sm:text-sm font-bold text-cyan-300 hover:bg-cyan-500 hover:text-white transition-all shadow-md shadow-cyan-950/50 self-start sm:self-auto shrink-0"
            >
              {copiedNumber ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              <span>{copiedNumber ? 'কপি হয়েছে (Copied)' : 'নাম্বার কপি করুন'}</span>
            </button>
          </div>

          {/* OTP Section DIRECTLY BELOW THE PHONE NUMBER */}
          <div>
            {activeOrder.status === 'WAITING' ? (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-center">
                <div className="inline-flex items-center justify-center p-2 rounded-full bg-cyan-950/80 border border-cyan-500/30 mb-2">
                  <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  ওটিপির জন্য অপেক্ষা করা হচ্ছে...
                </h3>
                <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                  উক্ত নাম্বারে {activeOrder.service} থেকে এসএমএস কোড পাঠান। কোড সেন্ড হলে সরাসরি এই নাম্বারের নিচে ভেসে উঠবে।
                </p>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>স্বয়ংক্রিয় লাইভ ওটিপি রিসিভার সচল...</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualCheckOtp}
                    disabled={manualChecking}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    {manualChecking ? 'চেক হচ্ছে...' : 'এখনই চেক করুন'}
                  </button>
                </div>
              </div>
            ) : (
              /* RECEIVED OTP DISPLAY RIGHT BELOW THE NUMBER */
              <div className="rounded-xl border-2 border-emerald-500/60 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 p-4 sm:p-5 shadow-xl shadow-emerald-950/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-inner">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>ওটিপি কোড গৃহীত হয়েছে (OTP Code Received):</span>
                      </div>

                      <div className="mt-1 flex items-center gap-3 flex-wrap">
                        <span className="text-3xl sm:text-5xl font-black tracking-widest text-emerald-300 font-mono select-all bg-black/60 px-4 py-1.5 rounded-xl border border-emerald-500/50 shadow-lg">
                          {activeOrder.otpCode}
                        </span>

                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeOrder.otpCode || '', 'otp')}
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs sm:text-sm font-black text-white hover:brightness-110 transition-all shadow-lg shadow-emerald-950/60 active:scale-95"
                        >
                          {copiedOtp ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          <span>{copiedOtp ? 'Copied' : 'ওটিপি কপি করুন'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-400 self-end sm:self-center font-mono">
                    {activeOrder.updatedAt && (
                      <div>গৃহীত: {new Date(activeOrder.updatedAt).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>

                {activeOrder.fullMessage && (
                  <div className="mt-3.5 rounded-xl border border-emerald-500/20 bg-black/50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      সম্পূর্ণ এসএমএস বার্তা (Full SMS Payload):
                    </div>
                    <div className="text-xs font-mono text-emerald-200/90 leading-relaxed break-words font-medium">
                      "{activeOrder.fullMessage}"
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* If no activeOrder is open, but recentOrders has items, show a small quick recovery card */}
      {!activeOrder && recentOrders.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 truncate">
            <History className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-slate-400">সর্বশেষ গৃহীত নাম্বার:</span>
            <span className="font-mono font-bold text-white truncate">{recentOrders[0].phoneNumber}</span>
            <span className="text-cyan-400 font-semibold">({recentOrders[0].service})</span>
            {recentOrders[0].otpCode && (
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                OTP: {recentOrders[0].otpCode}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setActiveOrder(recentOrders[0])}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-200 shrink-0 ml-2"
          >
            উপরে দেখুন
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                Live Cloud Gateway
              </span>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
              Get Number / ভার্চুয়াল নাম্বার নিন
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              প্যানেলে সক্রিয় সার্ভিস ও রেঞ্জ থেকে সরাসরি নাম্বার প্রোভিশন করুন এবং লাইভ ওটিপি রিসিভ করুন।
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto rounded-xl border border-cyan-500/30 bg-slate-950/80 px-3 py-1.5 text-xs">
            <span className="text-slate-400">অরিজিনাল লাইভ সার্ভিস:</span>
            <span className="font-mono font-bold text-cyan-300">{serviceGroups.length} টি</span>
          </div>
        </div>
      </div>

      {/* Error Alert if any */}
      {errorMsg && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-rose-200 shadow-lg animate-in fade-in">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs sm:text-sm font-medium">{errorMsg}</p>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs font-bold text-rose-400 hover:text-rose-200 shrink-0"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* DYNAMIC SERVICE & AUTOMATIC MATCHING RANGES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Step 1: Services & Matched Ranges */}
        <div className="lg:col-span-2 space-y-4">
          {/* Services Box */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-black text-cyan-400 border border-cyan-500/30">
                  1
                </span>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  উপলব্ধ সার্ভিস নির্বাচন করুন (প্যানেলে সক্রিয় সার্ভিস)
                </h2>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                {serviceGroups.length} টি লাইভ সার্ভিস
              </span>
            </div>

            {/* Dynamic Services Grid */}
            {serviceGroups.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 rounded-xl bg-slate-950/50">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-cyan-400" />
                সক্রিয় সার্ভিস ও রুট লোড হচ্ছে...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
                {serviceGroups.map((grp) => {
                  const isSelected = selectedServiceKey === grp.key;
                  return (
                    <button
                      key={grp.key}
                      type="button"
                      onClick={() => handleSelectService(grp.key)}
                      className={`group relative flex flex-col justify-between rounded-xl border p-2.5 sm:p-3 text-left transition-all ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-950/60'
                          : 'border-slate-800/80 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs sm:text-sm font-bold truncate">
                          {grp.displayName}
                        </span>
                        {getServiceIcon(grp.key)}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 border border-slate-800">
                          {grp.ranges.length} টি রেঞ্জ
                        </span>
                        <span className="font-bold text-emerald-400">{grp.totalHits} hits</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Matched Ranges Box for Selected Service */}
          {currentServiceGroup && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-400 border border-emerald-500/30">
                    2
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-amber-400" />
                      <span>{currentServiceGroup.displayName} এর জন্য সক্রিয় রেঞ্জসমূহ</span>
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400">
                      সেরা রেঞ্জটি স্বয়ংক্রিয়ভাবে সিলেক্ট করা হয়েছে। চাইলে নিচে থেকে যেকোনো রেঞ্জ বেছে নিতে পারেন:
                    </p>
                  </div>
                </div>

                {/* Range search within service */}
                {currentServiceGroup.ranges.length > 4 && (
                  <div className="relative w-full sm:w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={rangeSearch}
                      onChange={(e) => setRangeSearch(e.target.value)}
                      placeholder="রেঞ্জ সার্চ..."
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Range Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
                {displayedRanges.map((r) => {
                  const isCur = selectedRange === r.range;
                  const cInfo = detectCountryFromRange(r.range);

                  return (
                    <button
                      key={`${r.range}-${r.tag}-${r.hits}`}
                      type="button"
                      onClick={() => setSelectedRange(r.range)}
                      className={`flex flex-col justify-between rounded-xl border p-2.5 text-left text-xs transition-all ${
                        isCur
                          ? 'border-emerald-400 bg-emerald-950/50 text-emerald-200 ring-2 ring-emerald-400/60 shadow-md shadow-emerald-950/50'
                          : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-black text-xs sm:text-sm text-white">
                          {r.range}
                        </span>
                        <span className="text-xs" title={cInfo.name}>{cInfo.flag}</span>
                      </div>

                      <div className="mt-1 text-[10px] text-slate-300 font-medium truncate">
                        {cInfo.name}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                        <span className="truncate max-w-[70px]">{r.tag || 'Standard'}</span>
                        <span className="text-emerald-400 font-bold">{r.hits || 0} hits</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Selected Summary & Big Action Button */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 flex flex-col justify-between backdrop-blur-sm self-start w-full">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-black text-cyan-400 border border-cyan-500/30">
                  3
                </span>
                <h3 className="text-sm font-bold text-white">নির্বাচিত রেঞ্জ ও সার্ভিস সারাংশ</h3>
              </div>

              {/* Automatic Selection Summary */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">নির্বাচিত সার্ভিস:</span>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    {currentServiceGroup && getServiceIcon(currentServiceGroup.key)}
                    <span>{currentServiceGroup?.displayName || 'N/A'}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">অটো-ম্যাচড রেঞ্জ:</span>
                  <span className="font-mono font-black text-cyan-300 text-sm">
                    {selectedRange || 'স্বয়ংক্রিয় নির্বাচন'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">দেশ / রুট:</span>
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <span>{selectedRangeCountry.flag}</span>
                    <span>{selectedRangeCountry.name}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400">সংযোগ স্ট্যাটাস:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    লাইভ রুট প্রস্তুত
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 text-[11px] text-slate-400 leading-relaxed">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 inline mr-1" />
              আপনার নির্বাচিত সার্ভিসের সাথে লাইভ প্যানেলের রেঞ্জ শতভাগ মেলানো হয়েছে। বাটন চাপলেই নাম্বার জেনারেট হবে।
            </div>
          </div>

          {/* Action Button: Get Number */}
          <div className="mt-5 border-t border-slate-800/80 pt-4">
            <button
              onClick={handleGetNumber}
              disabled={loading || !selectedRange}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-600 to-indigo-600 py-3.5 px-4 text-xs sm:text-sm font-black text-white shadow-lg shadow-cyan-500/25 hover:brightness-110 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>নাম্বার বরাদ্দ করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <PhoneCall className="h-4 w-4" />
                  <span>Get Number / ভার্চুয়াল নাম্বার নিন</span>
                </>
              )}
            </button>

            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center">
              <Server className="h-3 w-3 text-emerald-400" />
              <span>NXV Instant Carrier Allocation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
