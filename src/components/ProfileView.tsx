import React, { useState, useEffect } from 'react';
import {
  User,
  PhoneCall,
  CheckCircle2,
  TrendingUp,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Award,
  Users,
  Wallet,
  Coins,
  Send,
  ExternalLink,
  Zap,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Bot,
  Activity,
  Code2,
  Sparkles,
  AlertCircle,
  Clock,
  RefreshCw,
  Terminal,
  Globe,
  Play,
  Server,
  Radio,
} from 'lucide-react';
import { UserProfile, requestApiAccess } from '../lib/firebase';

interface ProfileViewProps {
  userProfile: UserProfile | null;
  onLogout: () => void;
  ordersCount: number;
  otpsCount: number;
  onOpenAdmin?: () => void;
  onOpenAgentUsers?: () => void;
  onOpenWithdraw?: () => void;
  onUpdateProfile?: (updated: UserProfile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  onLogout,
  ordersCount,
  otpsCount,
  onOpenAdmin,
  onOpenAgentUsers,
  onOpenWithdraw,
  onUpdateProfile,
}) => {
  if (!userProfile) return null;

  const [showApiKey, setShowApiKey] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestReason, setRequestReason] = useState('Telegram Bot & SMS Integration');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'python' | 'curl' | 'node' | 'php'>('python');

  const [isSyncingProfile, setIsSyncingProfile] = useState(false);

  // Live Interactive API Tester
  const [testerEndpoint, setTesterEndpoint] = useState<'get-number' | 'get-otp' | 'active-rangre' | 'balance'>('get-number');
  const [testerResult, setTesterResult] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRequestApi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.id) return;
    setIsSubmittingRequest(true);
    try {
      const res = await requestApiAccess(userProfile.id, requestReason);
      if (res.success) {
        if (onUpdateProfile && res.user) {
          onUpdateProfile(res.user);
        } else {
          userProfile.apiAccessStatus = 'pending';
          userProfile.apiRequestReason = requestReason;
        }
        setShowRequestModal(false);
      }
    } catch (err) {
      console.warn('API request error:', err);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const [localProfile, setLocalProfile] = useState<UserProfile | null>(userProfile);

  // Synchronize localProfile with userProfile prop updates
  useEffect(() => {
    if (userProfile) {
      setLocalProfile((prev) => {
        if (!prev) return userProfile;
        const effectiveApiKey = userProfile.apiKey || prev.apiKey || '';
        const effectiveApiStatus =
          userProfile.apiAccessStatus === 'approved' || prev.apiAccessStatus === 'approved'
            ? 'approved'
            : (userProfile.apiAccessStatus || prev.apiAccessStatus || 'none');
        return {
          ...prev,
          ...userProfile,
          apiKey: effectiveApiKey,
          apiAccessStatus: effectiveApiStatus,
          apiHits: typeof prev.apiHits === 'number' && (!userProfile.apiHits || userProfile.apiHits < prev.apiHits)
            ? prev.apiHits
            : (userProfile.apiHits ?? prev.apiHits),
        };
      });
    }
  }, [userProfile]);

  const activeProfile = localProfile || userProfile;
  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://nxvsms.com';
  const apiKey = activeProfile.apiKey || '';
  const apiStatus = activeProfile.apiAccessStatus || (apiKey ? 'approved' : 'none');
  const hasApprovedApi = Boolean(apiKey) || apiStatus === 'approved';

  // Synchronize latest profile directly from backend
  const refreshProfile = async () => {
    const lookupKey = activeProfile?.id || activeProfile?.email || userProfile?.id || userProfile?.email;
    if (!lookupKey) return;
    setIsSyncingProfile(true);
    try {
      const res = await fetch(`/api/users/profile/${encodeURIComponent(lookupKey)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.user) {
          setLocalProfile((prev) => ({
            ...(prev || activeProfile),
            ...json.user,
          }));
          if (onUpdateProfile) {
            onUpdateProfile(json.user);
          }
        }
      }
    } catch {}
    setIsSyncingProfile(false);
  };

  useEffect(() => {
    refreshProfile();
    // Periodic check every 2.5 seconds to instantly capture admin approval
    const timer = setInterval(refreshProfile, 2500);
    return () => clearInterval(timer);
  }, [activeProfile?.id, activeProfile?.email]);

  const handleTestEndpoint = async (ep: 'get-number' | 'get-otp' | 'active-rangre' | 'balance') => {
    if (!apiKey) return;
    setIsTestingApi(true);
    setTesterEndpoint(ep);
    setTesterResult(null);
    try {
      let testUrl = `${originUrl}/${ep}?api_key=${encodeURIComponent(apiKey)}`;
      if (ep === 'get-number') {
        testUrl += '&service=Telegram';
      } else if (ep === 'get-otp') {
        testUrl += '&orderId=DEMO_TEST_ORDER';
      }
      const res = await fetch(testUrl);
      const json = await res.json();
      setTesterResult(JSON.stringify(json, null, 2));
    } catch (err: any) {
      setTesterResult(JSON.stringify({ error: err.message || 'Network request failed' }, null, 2));
    } finally {
      setIsTestingApi(false);
    }
  };

  const isAdmin = userProfile.role === 'admin' || userProfile.email === 'mnshiddik11@gmail.com';
  const isAgent = userProfile.role === 'agent';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Banned Alert Banner if account is suspended */}
      {userProfile.isBanned && (
        <div className="rounded-2xl border-2 border-red-500/60 bg-red-950/70 p-4 sm:p-5 backdrop-blur-md text-red-200">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/30 border border-red-500/50 text-red-300 shrink-0">
              <Ban className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-red-100">
                অ্যাকাউন্ট সাময়িকভাবে স্থগিত (Account Suspended / Banned)
              </h2>
              <p className="text-xs text-red-300 mt-0.5">
                এডমিন কর্তৃক আপনার অ্যাকাউন্টে নতুন ভার্চুয়াল নাম্বার সংগ্রহ স্থগিত রাখা হয়েছে।
                {userProfile.banReason ? ` কারণ: ${userProfile.banReason}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Agent Privilege Card if role is Agent */}
      {isAgent && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 p-4 sm:p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shrink-0">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  অফিসিয়াল এজেন্ট সুবিধা সক্রিয় (Agent Perks Active)
                </h3>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-emerald-300 border border-emerald-500/30">
                  VERIFIED AGENT
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                আপনি একজন সার্টিফাইড এজেন্ট! আপনার নিজস্ব প্রতি ওটিপিতে আয় <strong className="text-emerald-300 font-mono">৳০.৫০ (৫০ পয়সা)</strong> এবং আপনার ইউজারের প্রতিটি ওটিপি থেকে ম্যাক্স ৬০ পয়সার বাকি অবশিষ্ট টাকা আপনার কমিশন হিসেবে জমা হবে।
              </p>
              {onOpenAgentUsers && (
                <div className="mt-2.5">
                  <button
                    onClick={onOpenAgentUsers}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>ইউজার ম্যানেজমেন্ট ওপেন করুন (পেন্ডিং অনুমোদন ও কমিশন)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/40 via-slate-900 to-slate-900 p-4 sm:p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-xl sm:text-2xl font-black text-white shadow-lg shadow-violet-950/60 border border-violet-400/30">
              {userProfile.displayName ? userProfile.displayName[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black text-white">
                  {userProfile.displayName}
                </h1>
                {isAdmin ? (
                  <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-[10px] font-bold text-red-300 border border-red-500/40 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    ADMIN
                  </span>
                ) : isAgent ? (
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    AGENT
                  </span>
                ) : (
                  <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300 border border-violet-500/30 uppercase">
                    {userProfile.role}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{userProfile.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-emerald-300 font-bold flex items-center gap-1">
                  <Coins className="h-3 w-3 text-emerald-400" />
                  <span>
                    ওটিপি প্রতি আয়: ৳{(isAgent ? 0.50 : (userProfile.perOtpRate && userProfile.perOtpRate >= 0.30 ? userProfile.perOtpRate : 0.30)).toFixed(2)}
                    {isAgent ? ' (৫০ পয়সা/OTP)' : ''}
                  </span>
                </span>
                {userProfile.agentEmail && (
                  <span className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-0.5 text-slate-300 font-mono">
                    এজেন্ট: {userProfile.agentEmail}
                  </span>
                )}
                <span className="text-slate-500">
                  UID: <span className="font-mono text-slate-400">{userProfile.id}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isAdmin && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-950/30 px-3.5 py-2 text-xs font-bold text-red-300 hover:bg-red-950/50 transition-colors"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Admin Panel</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-950/40 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>
      </div>

      {/* Usage Analytics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Balance Card */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-slate-900/80 p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-amber-200">Current Balance</span>
            <Wallet className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-300">
            ৳{(userProfile.balance || 0).toFixed(2)}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>উত্তোলনযোগ্য ব্যালেন্স</span>
            {onOpenWithdraw && (
              <button
                type="button"
                onClick={onOpenWithdraw}
                className="text-amber-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>উইথড্র করুন</span>
                <span>→</span>
              </button>
            )}
          </div>
        </div>

        {/* Per OTP Rate Card */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-slate-900/80 p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-emerald-200">প্রতি ওটিপি আয় (Rate)</span>
            <Coins className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-300">
            ৳{(userProfile.perOtpRate && userProfile.perOtpRate >= 0.30 ? userProfile.perOtpRate : 0.30).toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400/80">
            প্রতি সফল ওটিপিতে আপনার ব্যালেন্সে জমা হবে
          </div>
        </div>

        {/* Total Numbers */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Numbers Requested</span>
            <PhoneCall className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">{ordersCount}</div>
          <div className="mt-1 text-[11px] text-slate-500">গৃহীত ভার্চুয়াল নাম্বার</div>
        </div>

        {/* OTPs Received */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">OTPs Received</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{otpsCount}</div>
          <div className="mt-1 text-[11px] text-slate-500">প্রাপ্ত সফল ওটিপি কোড</div>
        </div>
      </div>

      {/* API & Telegram Bot Integration Section */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 p-4 sm:p-6 backdrop-blur-md shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/60 border border-purple-400/30 shrink-0">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white">
                  টেলিগ্রাম বট ও এপিআই সিস্টেম (Telegram Bot & API Hub)
                </h2>
                {hasApprovedApi ? (
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    API সচল (ACTIVE)
                  </span>
                ) : apiStatus === 'pending' ? (
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-black text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                    <Clock className="h-3 w-3" />
                    এডমিন অনুমোদন অপেক্ষমাণ (PENDING)
                  </span>
                ) : apiStatus === 'rejected' ? (
                  <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-black text-rose-300 border border-rose-500/40 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    বাতিলকৃত (REJECTED)
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-700">
                    আবেদন করা হয়নি
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                টেলিগ্রাম বট ইন্টিগ্রেশন, স্বয়ংক্রিয় ভার্চুয়াল নাম্বার ও ওটিপি রিসিভ এপিআই
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!hasApprovedApi && apiStatus !== 'pending' && (
              <button
                onClick={() => setShowRequestModal(true)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/60 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Key className="h-4 w-4" />
                <span>API এক্সেস এর জন্য রিকোয়েস্ট করুন</span>
              </button>
            )}

            {apiStatus === 'pending' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 font-semibold">
                <Clock className="h-3.5 w-3.5 animate-spin" />
                <span>এডমিন রিভিউ চলছে...</span>
              </div>
            )}
          </div>
        </div>

        {/* State 1: Not Requested yet */}
        {apiStatus === 'none' && (
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white mb-1.5">
              টেলিগ্রাম বট তৈরি করে স্বয়ংক্রিয়ভাবে ওটিপি রিসিভ করুন
            </h3>
            <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed mb-4">
              আপনি কি টেলিগ্রাম বট বা কোনো অ্যাপ দিয়ে আমাদের ওয়েবসাইট থেকে সরাসরি নাম্বার নিতে চান? এডমিনের কাছে API এক্সেসের আবেদন করুন। অনুমোদন পেলেই আপনি ইউনিক API Key এবং লাইভ ওটিপি রিসিভ এন্ডপয়েন্ট পাবেন। <strong>বটের মাধ্যমে ওটিপি রিসিভ হলেও স্বয়ংক্রিয়ভাবে আপনার ওয়েবসাইটের ব্যালেন্সে টাকা যুক্ত হবে!</strong>
            </p>
            <button
              onClick={() => setShowRequestModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/60 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Key className="h-4 w-4" />
              <span>এপিআই এক্সেস এর জন্য আবেদন করুন (Request API Access)</span>
            </button>
          </div>
        )}

        {/* State 2: Pending Approval */}
        {apiStatus === 'pending' && (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 flex items-start gap-3.5">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-200">
                আপনার এপিআই রিকোয়েস্ট এডমিনের কাছে জমা রয়েছে
              </h4>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                এডমিন প্যানেলে আপনার রিকোয়েস্ট পৌঁছেছে। এডমিন অনুমোদন করে দিলেই এখানে আপনার ব্যক্তিগত সিক্রেট API Key এবং টেলিগ্রাম বটের সাথে যুক্ত করার সমস্ত এন্ডপয়েন্ট ইউআরএল (Get Number, Receive OTP, Cancel Number) প্রদর্শিত হবে।
              </p>
              {userProfile.apiRequestReason && (
                <div className="text-[11px] font-mono text-slate-400 pt-1">
                  আবেদনের কারণ: <span className="text-slate-200">{userProfile.apiRequestReason}</span>
                </div>
              )}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshProfile}
                  disabled={isSyncingProfile}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-900/40 hover:bg-amber-900/60 px-3 py-1.5 text-[11px] font-bold text-amber-200 transition-all cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncingProfile ? 'animate-spin' : ''}`} />
                  <span>{isSyncingProfile ? 'যাচাই করা হচ্ছে...' : 'অনুমোদন স্ট্যাটাস রিফ্রেশ করুন'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* State 3: Rejected */}
        {apiStatus === 'rejected' && (
          <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-200">
                  আপনার পূর্ববর্তী এপিআই রিকোয়েস্ট বাতিল করা হয়েছে
                </h4>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  {userProfile.rejectionReason || 'এডমিন কর্তৃক আবেদন বাতিল করা হয়েছে। প্রয়োজনে পুনরায় আবেদন করতে পারেন।'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRequestModal(true)}
              className="rounded-xl border border-rose-500/40 bg-rose-950/50 hover:bg-rose-900/60 text-white px-4 py-2 text-xs font-bold transition-all"
            >
              পুনরায় আবেদন করুন
            </button>
          </div>
        )}

        {/* State 4: Approved & Active API */}
        {hasApprovedApi && (
          <div className="mt-5 space-y-6">
            {/* 1. Header Credentials Cards: Token and Base URL (Clean 2-card layout) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Card 1: API Token */}
              <div className="rounded-2xl border border-purple-500/40 bg-slate-950/90 p-4 sm:p-5 space-y-2.5 shadow-lg shadow-purple-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="h-4 w-4 text-purple-400" />
                    এপিআই টোকেন (API Secret Token)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title={showApiKey ? 'Hide Token' : 'Show Token'}
                    >
                      {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(apiKey, 'apiKey')}
                      className="flex items-center gap-1 rounded-lg bg-purple-500/20 border border-purple-500/40 px-2 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-500/30 transition-all cursor-pointer"
                    >
                      {copiedKey === 'apiKey' ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-300">কপি হয়েছে!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>কপি</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="font-mono text-xs sm:text-sm bg-slate-900/90 p-2.5 rounded-xl border border-purple-500/30 text-purple-200 break-all select-all font-semibold">
                  {showApiKey ? apiKey : `${apiKey.slice(0, 10)}••••••••••••••••••••••••${apiKey.slice(-6)}`}
                </div>

                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  🔒 সিক্রেট বটের কি (Header: <code className="text-purple-300">x-api-key</code> অথবা URL: <code className="text-purple-300">?api_key=</code>)
                </p>
              </div>

              {/* Card 2: Base URL */}
              <div className="rounded-2xl border border-cyan-500/40 bg-slate-950/90 p-4 sm:p-5 space-y-2.5 shadow-lg shadow-cyan-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="h-4 w-4 text-cyan-400" />
                    বেস ইউআরএল (API Base URL)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(originUrl, 'originUrl')}
                    className="flex items-center gap-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-2 py-1 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/30 transition-all cursor-pointer"
                  >
                    {copiedKey === 'originUrl' ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-300">কপি হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>কপি</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="font-mono text-xs sm:text-sm bg-slate-900/90 p-2.5 rounded-xl border border-cyan-500/30 text-cyan-200 break-all select-all font-semibold">
                  {originUrl}
                </div>

                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  🌐 সমস্ত এপিআই এন্ডপয়েন্টের মূল সার্ভার হোস্ট ডোমেইন
                </p>
              </div>
            </div>

            {/* 2. Clean & Direct Telegram Bot URLs */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-cyan-400" />
                    <span>টেলিগ্রাম বট ইন্টিগ্রেশন ইউআরএল (Telegram Bot API URLs)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    টেলিগ্রাম বট তৈরির জন্য সরাসরি পরিষ্কার ইউআরএল (পিছনে কোনো বাড়তি জটলা বা এক্সট্রা কিছু ছাড়া)
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                {/* 1. Get Number Endpoint: main URL/get-number */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 space-y-1.5 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-500/40">
                        GET / POST
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        ১. গেট নাম্বার ইউআরএল (Get Number URL)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${originUrl}/get-number`, 'ep_getnum')}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'ep_getnum' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'ep_getnum' ? 'কপি হয়েছে' : 'লিঙ্ক কপি করুন'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[11px] sm:text-xs text-cyan-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 break-all select-all font-semibold">
                    {originUrl}/get-number
                  </div>
                  <p className="text-[10px] text-slate-400">
                    টেলিগ্রাম বা অন্যান্য সার্ভিসের ভার্চুয়াল নাম্বার নেওয়ার সরাসরি ক্লিন ইউআরএল।
                  </p>
                </div>

                {/* 2. Get OTP Endpoint: main URL/get-otp */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 space-y-1.5 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-black text-cyan-400 border border-cyan-500/40">
                        GET / POST
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        ২. ওটিপি ইনফরমেশন ইউআরএল (Get OTP URL)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${originUrl}/get-otp`, 'ep_getotp')}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'ep_getotp' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'ep_getotp' ? 'কপি হয়েছে' : 'লিঙ্ক কপি করুন'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[11px] sm:text-xs text-emerald-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 break-all select-all font-semibold">
                    {originUrl}/get-otp
                  </div>
                  <p className="text-[10px] text-slate-400">
                    ওটিপি কোড গ্রহণ করার ইউআরএল। ওটিপি রিসিভ হওয়ার সাথে সাথে একাউন্ট ব্যালেন্সে টাকা জমা হবে।
                  </p>
                </div>

                {/* 3. Active Ranges: main URL/active-rangre */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 space-y-1.5 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-black text-indigo-400 border border-indigo-500/40">
                        GET
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        ৩. একটিভ রেঞ্জ ইউআরএল (Active Range URL)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${originUrl}/active-rangre`, 'ep_ranges')}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'ep_ranges' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'ep_ranges' ? 'কপি হয়েছে' : 'লিঙ্ক কপি করুন'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[11px] sm:text-xs text-indigo-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 break-all select-all font-semibold">
                    {originUrl}/active-rangre
                  </div>
                  <p className="text-[10px] text-slate-400">
                    লাইভ সক্রিয় টেলিকম অপারেটর ও কান্ট্রি রেঞ্জ দেখার সরাসরি ক্লিন ইউআরএল।
                  </p>
                </div>

                {/* 4. Cancel Number: main URL/cancel-number */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 space-y-1.5 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-400 border border-amber-500/40">
                        GET / POST
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        ৪. নাম্বার বাতিল ইউআরএল (Cancel Number URL)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${originUrl}/cancel-number`, 'ep_cancel')}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'ep_cancel' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'ep_cancel' ? 'কপি হয়েছে' : 'লিঙ্ক কপি করুন'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[11px] sm:text-xs text-amber-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 break-all select-all font-semibold">
                    {originUrl}/cancel-number
                  </div>
                  <p className="text-[10px] text-slate-400">
                    বরাদ্দকৃত ভার্চুয়াল নাম্বার বাতিল (Cancel) করার সরাসরি ইউআরএল।
                  </p>
                </div>

                {/* 5. Check Balance: main URL/balance */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 space-y-1.5 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-black text-violet-400 border border-violet-500/40">
                        GET
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        ৫. একাউন্ট ব্যালেন্স ইউআরএল (Check Balance URL)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${originUrl}/balance`, 'ep_bal')}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'ep_bal' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'ep_bal' ? 'কপি হয়েছে' : 'লিঙ্ক কপি করুন'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[11px] sm:text-xs text-violet-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 break-all select-all font-semibold">
                    {originUrl}/balance
                  </div>
                  <p className="text-[10px] text-slate-400">
                    বটের ভেতর থেকে সরাসরি নিজের একাউন্ট ব্যালেন্স ও মোট ওটিপি সংখ্যা চেক করার ইউআরএল।
                  </p>
                </div>
              </div>

              {/* Bot Integration Note */}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 sm:p-4 text-xs text-slate-300 flex items-start gap-2.5 mt-2">
                <Sparkles className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-cyan-200">
                    বটে ব্যবহারের নিয়ম (Header ও প্যারামিটার উভয়ই সাপোর্টেড):
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    ইউআরএলগুলো সরাসরি ক্লিন ভাবে কাজ করবে। আপনার রিকোয়েস্টের সাথে Header এ <code className="text-cyan-300">x-api-key: {apiKey ? `${apiKey.slice(0, 10)}...` : 'YOUR_TOKEN'}</code> অথবা URL-এ <code className="text-cyan-300">?api_key={apiKey ? `${apiKey.slice(0, 10)}...` : 'YOUR_TOKEN'}</code> ব্যবহার করে যেকোনো টেলিগ্রাম বট থেকে সহজে ডাটা পাঠানো ও রিসিভ করা যাবে।
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Live Interactive API Tester & Console */}
            <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/90 p-4 sm:p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>লাইভ এপিআই টেস্টার ও কনসোল (Live Interactive Tester)</span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                        200 OK
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      আপনার নিজস্ব API Key দিয়ে সরাসরি লাইভ রেসপন্স টেস্ট করুন
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['get-number', 'get-otp', 'active-rangre', 'balance'] as const).map((ep) => (
                    <button
                      key={ep}
                      type="button"
                      onClick={() => handleTestEndpoint(ep)}
                      disabled={isTestingApi}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        testerEndpoint === ep
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Play className="h-3 w-3" />
                      <span>{ep === 'get-number' ? '/get-number' : ep === 'get-otp' ? '/get-otp' : ep === 'active-rangre' ? '/active-rangre' : '/balance'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Terminal Screen */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-500 text-[11px] pb-2 mb-2 border-b border-slate-800">
                  <span>TERMINAL: GET /{testerEndpoint}?api_key={apiKey.slice(0, 8)}...</span>
                  <span className="text-emerald-400">{isTestingApi ? 'Testing...' : 'STATUS: READY'}</span>
                </div>
                <pre className="text-emerald-300 text-[11px] leading-relaxed max-h-56 overflow-y-auto overflow-x-auto no-scrollbar font-mono">
                  {testerResult ||
                    JSON.stringify(
                      {
                        status: 'CLICK_TEST_BUTTON_ABOVE',
                        message: 'উপরের বাটনগুলোতে ক্লিক করে আপনার লাইভ এপিআই টেস্ট করুন।',
                        apiKeyValid: true,
                        server: originUrl,
                        userRole: activeProfile.role,
                        balanceBDT: activeProfile.balance,
                      },
                      null,
                      2
                    )}
                </pre>
              </div>
            </div>

            {/* 4. Ready Telegram Bot Sample Code */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-purple-400" />
                  <span>টেলিগ্রাম বট তৈরি করার সম্পূর্ণ সোর্স কোড (Ready Bot Source Code)</span>
                </span>
                <div className="flex gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  {(['python', 'node', 'curl'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveCodeTab(tab)}
                      className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-all ${
                        activeCodeTab === tab
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab === 'python' ? 'Python' : tab === 'node' ? 'Node.js' : 'cURL'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-96">
                  {activeCodeTab === 'python' &&
`import requests
import time

# ১. আপনার ক্রেডেনশিয়ালস
API_KEY = "${apiKey}"
BASE_URL = "${originUrl}"

# ২. টেলিগ্রাম সার্ভিসের জন্য ভার্চুয়াল নাম্বার গ্রহণ
def get_number(service="Telegram"):
    url = f"{BASE_URL}/get-number"
    params = {
        "api_key": API_KEY,
        "service": service
    }
    response = requests.get(url, params=params)
    data = response.json()
    if data.get("success"):
        print(f"✅ নাম্বার বরাদ্দ সফল: {data.get('phoneNumber')}")
        print(f"📦 Order ID: {data.get('orderId')}")
        return data.get("orderId"), data.get("phoneNumber")
    else:
        print("❌ এরর:", data.get("error"))
        return None, None

# ৩. ওটিপি প্রাপ্তির জন্য অটো-পোলিং লুপ (Auto-credit website balance on arrival)
def check_otp(order_id):
    url = f"{BASE_URL}/get-otp"
    params = {"api_key": API_KEY, "orderId": order_id}
    
    print("⏳ ওটিপির জন্য অপেক্ষা করা হচ্ছে (Max 10 minutes)...")
    for attempt in range(60):
        time.sleep(4)
        res = requests.get(url, params=params)
        data = res.json()
        if data.get("status") == "RECEIVED":
            print(f"🎉 ওটিপি রিসিভ হয়েছে! Code: {data.get('otp')}")
            print(f"💰 ওয়েবসাইটের নতুন ব্যালেন্স: ৳{data.get('newBalance')}")
            return data.get("otp")
        elif data.get("status") == "EXPIRED":
            print("⚠️ ১০ মিনিট শেষ হওয়ায় নম্বরের মেয়াদ শেষ।")
            break
    return None

if __name__ == "__main__":
    order_id, phone = get_number()
    if order_id:
        check_otp(order_id)`}
                  {activeCodeTab === 'node' &&
`import axios from 'axios';

const API_KEY = '${apiKey}';
const BASE_URL = '${originUrl}';

async function runTelegramBot() {
  try {
    // ১. নাম্বার বরাদ্দ (main URL/get-number)
    const { data: numData } = await axios.get(\`\${BASE_URL}/get-number\`, {
      params: { api_key: API_KEY, service: 'Telegram' }
    });

    if (!numData.success) {
      console.error('Error:', numData.error);
      return;
    }

    console.log('✅ Allocated Number:', numData.phoneNumber);
    console.log('📦 Order ID:', numData.orderId);

    // ২. ওটিপি পোলিং (main URL/get-otp)
    const interval = setInterval(async () => {
      const { data: otpData } = await axios.get(\`\${BASE_URL}/get-otp\`, {
        params: { api_key: API_KEY, orderId: numData.orderId }
      });

      if (otpData.status === 'RECEIVED') {
        console.log('🎉 OTP Code:', otpData.otp);
        console.log('💰 Website Balance Credited! New Balance: ৳', otpData.newBalance);
        clearInterval(interval);
      } else if (otpData.status === 'EXPIRED') {
        console.log('⚠️ Number Expired after 10 minutes');
        clearInterval(interval);
      }
    }, 4000);
  } catch (err) {
    console.error('Request error:', err.message);
}

runTelegramBot();`}
                  {activeCodeTab === 'curl' &&
`# ১. ভার্চুয়াল নাম্বার গ্রহণ (main URL/get-number)
curl -X GET "${originUrl}/get-number?api_key=${apiKey}&service=Telegram"

# ২. ওটিপি ইনফরমেশন চেক (main URL/get-otp)
curl -X GET "${originUrl}/get-otp?api_key=${apiKey}&orderId=YOUR_ORDER_ID"

# ৩. লাইভ সক্রিয় রেঞ্জ (main URL/active-rangre)
curl -X GET "${originUrl}/active-rangre?api_key=${apiKey}"

# ৪. নাম্বার বাতিল (main URL/cancel-number)
curl -X GET "${originUrl}/cancel-number?api_key=${apiKey}&orderId=YOUR_ORDER_ID"

# ৫. একাউন্ট ব্যালেন্স চেক (main URL/balance)
curl -X GET "${originUrl}/balance?api_key=${apiKey}"`}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      activeCodeTab === 'python'
                        ? `import requests\nimport time\n\nAPI_KEY = "${apiKey}"\nBASE_URL = "${originUrl}"\n\nres = requests.get(f"{BASE_URL}/get-number", params={"api_key": API_KEY, "service": "Telegram"})\ndata = res.json()\nprint("Allocated:", data.get("phoneNumber"))\norder_id = data.get("orderId")\n\nfor _ in range(60):\n    time.sleep(4)\n    otp_res = requests.get(f"{BASE_URL}/get-otp", params={"api_key": API_KEY, "orderId": order_id})\n    otp_data = otp_res.json()\n    if otp_data.get("status") == "RECEIVED":\n        print("OTP:", otp_data.get("otp"))\n        break`
                        : `${originUrl}/get-number?api_key=${apiKey}&service=Telegram`,
                      'code_sample'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
                >
                  {copiedKey === 'code_sample' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedKey === 'code_sample' ? 'কপি হয়েছে' : 'কোড কপি করুন'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Request API Access */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-purple-500/40 bg-slate-900 p-5 sm:p-6 shadow-2xl shadow-purple-950/60">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3.5 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">API এক্সেস এর জন্য আবেদন</h3>
                <p className="text-xs text-slate-400">এডমিনের কাছে অনুমোদনের জন্য রিকোয়েস্ট পাঠান</p>
              </div>
            </div>

            <form onSubmit={handleRequestApi} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  আবেদনকারীর নাম ও ইমেইল:
                </label>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
                  {userProfile.displayName} ({userProfile.email})
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  এপিআই ব্যবহারের উদ্দেশ্য / বটের বিবরণ:
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="যেমন: টেলিগ্রাম বট বানিয়ে স্বয়ংক্রিয় ওটিপি রিসিভ করার জন্য..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-3 text-[11px] text-slate-300 leading-relaxed">
                ℹ️ এডমিন প্যানেলে আপনার রিকোয়েস্ট পৌঁছানোর পর এডমিন যাচাই করে আপনার API এক্সেস অনুমোদন করবে এবং আপনি একটি ইউনিক API Key পাবেন।
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  disabled={isSubmittingRequest}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmittingRequest ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>পাঠানো হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>রিকোয়েস্ট পাঠান</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Community & Developer Section */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/30 via-slate-900 to-indigo-950/30 p-4 sm:p-6 backdrop-blur-md">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              এডমিন ও অফিসিয়াল কমিউনিটি (Admin & Official Community)
            </h3>
            <p className="text-xs text-slate-400">
              সকল সাপোর্ট, লাইভ নোটিশ এবং সর্বশেষ আপডেটের জন্য আমাদের অফিশিয়াল চ্যানেলে যুক্ত থাকুন
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Official Channel Card */}
          <div className="rounded-xl border border-cyan-500/40 bg-slate-950/90 p-4 sm:p-5 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                  <Send className="h-4 w-4 text-cyan-400" />
                  অফিসিয়াল টেলিগ্রাম চ্যানেল
                </span>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                  OFFICIAL
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed mb-3">
                সার্ভার আপডেট, নতুন রুট/রেঞ্জ যোগ হওয়া, পেমেন্ট সংক্রান্ত নোটিশ ও লাইভ প্রুফ দেখতে আমাদের অফিসিয়াল টেলিগ্রাম চ্যানেলে জয়েন করুন।
              </p>
              <div className="text-[11px] font-mono text-cyan-400 bg-cyan-950/30 px-3 py-1.5 rounded-lg border border-cyan-500/20 mb-3 break-all select-all">
                https://t.me/nhbdofficial
              </div>
            </div>

            <a
              href="https://t.me/nhbdofficial"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-950 hover:brightness-110 transition-all cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>টেলিগ্রাম চ্যানেলে জয়েন করুন</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Developer & Admin Card */}
          <div className="rounded-xl border border-indigo-500/40 bg-slate-950/90 p-4 sm:p-5 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-indigo-300 flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-400" />
                  ডেভেলপার ও এডমিন সাপোর্ট
                </span>
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                  DEV CONTACT
                </span>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-300 mb-3">
                <div>
                  <span className="text-slate-400">ডেভেলপার:</span>{' '}
                  <span className="font-black text-white font-mono">NOOBXVAU</span>
                </div>
                <div>
                  <span className="text-slate-400">টেলিগ্রাম আইডি:</span>{' '}
                  <span className="font-bold text-cyan-300 font-mono">@noobxvau</span>
                </div>
                <div>
                  <span className="text-slate-400">এডমিন ইমেইল:</span>{' '}
                  <span className="font-mono text-slate-300">mnshiddik11@gmail.com</span>
                </div>
              </div>
              <p className="text-slate-400 text-[10px] leading-relaxed mb-3">
                কোনো প্রযুক্তিগত সমস্যা, একাউন্ট সংক্রান্ত কোনো প্রশ্ন বা এজেন্টের অনুমোদনের জন্য সরাসরি যোগাযোগ করতে পারেন।
              </p>
            </div>

            <a
              href="https://t.me/noobxvau"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/50 hover:bg-indigo-900/60 px-4 py-2.5 text-xs font-bold text-indigo-200 shadow-md transition-all cursor-pointer"
            >
              <Send className="h-3.5 w-3.5 text-indigo-400" />
              <span>ডেভেলপারের সাথে চ্যাট (@noobxvau)</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
