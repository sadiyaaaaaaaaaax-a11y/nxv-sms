import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User as UserIcon,
  LogIn,
  UserPlus,
  AlertCircle,
  Zap,
  ShieldCheck,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import {
  auth,
  UserProfile,
  fetchOrCreateUserProfile,
  validateAgentEmail,
} from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';

interface AuthPageProps {
  onSuccess: (profile: UserProfile) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live Agent verification status
  const [agentStatus, setAgentStatus] = useState<{
    checking: boolean;
    valid?: boolean;
    name?: string;
    email?: string;
    message?: string;
  }>({ checking: false });

  // Debounced live verification of agent email
  const verifyAgentLive = async (targetEmail: string) => {
    const clean = targetEmail.trim().toLowerCase();
    if (!clean) {
      setAgentStatus({ checking: false });
      return;
    }
    setAgentStatus({ checking: true });
    try {
      const res = await validateAgentEmail(clean);
      if (res.valid && res.agent) {
        setAgentStatus({
          checking: false,
          valid: true,
          name: res.agent.displayName || res.agent.email,
          email: res.agent.email,
        });
      } else {
        setAgentStatus({
          checking: false,
          valid: false,
          message: 'আপনার এই জিমেইলে কোন এজেন্ট নেই',
        });
      }
    } catch {
      setAgentStatus({ checking: false });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === 'login') {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const profile = await fetchOrCreateUserProfile(userCred.user);

        // Strict Check: User cannot login if status is pending!
        if (profile.role !== 'admin' && profile.status === 'pending') {
          await signOut(auth);
          setErrorMsg(`আপনার একাউন্টে এখনো পেন্ডিং আছে। আপনার এজেন্টের (${profile.agentEmail || 'Agent'}) অনুমোদনের জন্য অপেক্ষা করুন। অনুমোদন ছাড়া লগইন বা কাজ করা সম্ভব নয়।`);
          setLoading(false);
          return;
        }

        if (profile.role !== 'admin' && profile.status === 'rejected') {
          await signOut(auth);
          setErrorMsg(`আপনার একাউন্টটি বাতিল / রিজেক্ট করা হয়েছে।${profile.rejectionReason ? ` কারণ: ${profile.rejectionReason}` : ''}`);
          setLoading(false);
          return;
        }

        if (profile.isBanned) {
          await signOut(auth);
          setErrorMsg(`আপনার একাউন্টটি ব্যান / স্থগিত করা হয়েছে।${profile.banReason ? ` কারণ: ${profile.banReason}` : ''}`);
          setLoading(false);
          return;
        }

        onSuccess(profile);
      } else {
        if (!displayName.trim()) {
          setErrorMsg('দয়া করে আপনার নাম প্রদান করুন');
          setLoading(false);
          return;
        }

        const cleanAgent = agentEmail.trim().toLowerCase();
        if (!cleanAgent) {
          setErrorMsg('দয়া করে একজন এজেন্টের ইমেইল এড্রেস প্রদান করুন');
          setLoading(false);
          return;
        }

        // CRITICAL: Strict Agent Email Verification BEFORE Firebase account creation
        const valResult = await validateAgentEmail(cleanAgent);
        if (!valResult.valid) {
          setErrorMsg('আপনার এই জিমেইলে কোন এজেন্ট নেই');
          setLoading(false);
          return;
        }

        const verifiedAgentEmail = valResult.agent?.email || cleanAgent;

        // Store pending user metadata in localStorage so onAuthStateChanged detects it immediately
        localStorage.setItem(
          `nxv_pending_user_${cleanEmail}`,
          JSON.stringify({
            agentEmail: verifiedAgentEmail,
            displayName: displayName.trim(),
            timestamp: Date.now(),
          })
        );

        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(userCred.user, { displayName });
        await fetchOrCreateUserProfile(userCred.user, displayName, verifiedAgentEmail);

        // Immediately sign out user so they cannot enter app until agent approves
        await signOut(auth);
        setMode('login');
        setSuccessMsg(`আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! কিন্তু এটি এখনো পেন্ডিং অবস্থায় রয়েছে। এজেন্ট (${verifiedAgentEmail}) কর্তৃক অনুমোদনের পর আপনি লগইন করতে পারবেন।`);
      }
    } catch (err: any) {
      console.warn('Auth error:', err);
      let msg = err.message || 'অথেনটিকেশন ব্যর্থ হয়েছে';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'ইমেইল বা পাসওয়ার্ড সঠিক নয়';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'এই ইমেইলটি ইতিপূর্বে নিবন্ধিত হয়েছে। অনুগ্রহ করে লগইন করুন।';
      } else if (err.code === 'auth/weak-password') {
        msg = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'ইমেইল এড্রেসটি সঠিক নয়';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Icon */}
        <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-xl shadow-cyan-500/25 border border-cyan-400/30 mb-3 animate-pulse">
          <Zap className="h-8 w-8 sm:h-9 sm:w-9" />
        </div>

        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
          NXV <span className="text-cyan-400">SMS</span>
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
          উচ্চগতির ভার্চুয়াল নাম্বার ও লাইভ ওটিপি রিসিভার প্যানেল
        </p>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-5 sm:p-8 shadow-2xl shadow-cyan-950/50 backdrop-blur-md">
          {/* Tabs */}
          <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1 mb-5 sm:mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 rounded-lg py-2.5 text-xs sm:text-sm font-bold transition-all ${
                mode === 'login'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              লগইন (Sign In)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 rounded-lg py-2.5 text-xs sm:text-sm font-bold transition-all ${
                mode === 'register'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              রেজিস্ট্রেশন (Sign Up)
            </button>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-emerald-300 block mb-0.5">রেজিস্ট্রেশন সম্পন্ন!</span>
                <span>{successMsg}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  আপনার নাম (Full Name)
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="যেমন: Sabbir Ahmed"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/90 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ইমেইল এড্রেস (Email Address)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/90 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                পাসওয়ার্ড (Password)
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/90 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    এজেন্ট মেইল (Agent Email)
                  </label>
                  {agentStatus.checking && (
                    <span className="text-[10px] text-cyan-400 animate-pulse">যাচাই করা হচ্ছে...</span>
                  )}
                  {agentStatus.valid && (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> ভেরিফাইড এজেন্ট
                    </span>
                  )}
                  {agentStatus.valid === false && agentEmail.trim() && (
                    <span className="text-[10px] text-rose-400 font-semibold">
                      এজেন্ট পাওয়া যায়নি
                    </span>
                  )}
                </div>
                <div className="relative">
                  <ShieldCheck
                    className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
                      agentStatus.valid
                        ? 'text-emerald-400'
                        : agentStatus.valid === false && agentEmail.trim()
                        ? 'text-rose-400'
                        : 'text-slate-500'
                    }`}
                  />
                  <input
                    type="email"
                    required
                    value={agentEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAgentEmail(val);
                      verifyAgentLive(val);
                    }}
                    onBlur={() => verifyAgentLive(agentEmail)}
                    placeholder="agent@gmail.com"
                    className={`w-full rounded-xl border bg-slate-950/90 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                      agentStatus.valid
                        ? 'border-emerald-500/50 focus:border-emerald-400'
                        : agentStatus.valid === false && agentEmail.trim()
                        ? 'border-rose-500/50 focus:border-rose-400'
                        : 'border-slate-800 focus:border-cyan-400'
                    }`}
                  />
                </div>
                {agentStatus.valid && agentStatus.name && (
                  <p className="mt-1 text-[11px] text-emerald-400/90 flex items-center gap-1 animate-fadeIn">
                    ✓ এজেন্ট: <strong className="text-white">{agentStatus.name}</strong> ({agentStatus.email})
                  </p>
                )}
                {agentStatus.valid === false && agentEmail.trim() && (
                  <p className="mt-1 text-[11px] text-rose-400 font-semibold flex items-center gap-1 animate-fadeIn">
                    ⚠️ আপনার এই জিমেইলে কোন এজেন্ট নেই
                  </p>
                )}
                <p className="mt-1 text-[10px] text-slate-500">
                  * শুধুমাত্র রেজিস্টার্ড এজেন্টের অনুমোদনের মাধ্যমে অ্যাকাউন্ট সচল হবে।
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-cyan-500/25 hover:brightness-110 active:scale-98 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>লোড হচ্ছে...</span>
              ) : mode === 'login' ? (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>লগইন করুন</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>রেজিস্ট্রেশন করুন</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Feature Badges */}
        <div className="mt-5 grid grid-cols-2 gap-3 text-center text-xs text-slate-400">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
            <Radio className="h-4 w-4 text-cyan-400 mx-auto mb-1" />
            <div className="font-bold text-white text-[11px]">Direct Carrier Hub</div>
            <div className="text-[10px] text-slate-500">লাইভ নেটওয়ার্ক রুট</div>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
            <ShieldCheck className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
            <div className="font-bold text-white text-[11px]">Firebase Cloud</div>
            <div className="text-[10px] text-slate-500">নিরাপদ ডাটা সিঙ্ক</div>
          </div>
        </div>
      </div>
    </div>
  );
};
