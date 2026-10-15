import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Mail,
  User,
  Zap,
  Lock,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { UserProfile, fetchOrCreateUserProfile, auth, db } from '../lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

interface PendingApprovalViewProps {
  userProfile: UserProfile;
  onLogout: () => void;
  onApproved: (updatedProfile: UserProfile) => void;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({
  userProfile,
  onLogout,
  onApproved,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  // Real-time Firestore listener to automatically unlock dashboard when agent approves
  useEffect(() => {
    if (!userProfile?.id) return;
    const userDocRef = doc(db, 'users', userProfile.id);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        if (data.status === 'approved') {
          onApproved(data);
        }
      }
    });

    return () => unsubscribe();
  }, [userProfile?.id, onApproved]);

  const handleManualCheck = async () => {
    setIsRefreshing(true);
    setRefreshMsg(null);
    try {
      if (auth.currentUser) {
        // Direct Firestore check
        const directSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (directSnap.exists()) {
          const directData = directSnap.data() as UserProfile;
          if (directData.status === 'approved') {
            onApproved(directData);
            return;
          }
        }

        const refreshed = await fetchOrCreateUserProfile(auth.currentUser);
        if (refreshed.status === 'approved') {
          onApproved(refreshed);
          return;
        }
      }

      // Also check backend
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        const serverUser = (json.users || []).find(
          (u: any) =>
            u.id === userProfile.id ||
            u.email?.toLowerCase() === userProfile.email?.toLowerCase()
        );
        if (serverUser && serverUser.status === 'approved') {
          onApproved({ ...userProfile, ...serverUser, status: 'approved' });
          return;
        }
      }

      setRefreshMsg('আপনার একাউন্টটি এখনো পেন্ডিং আছে। এজেন্ট এখনো অনুমোদন করেননি।');
    } catch {
      setRefreshMsg('স্ট্যাটাস রিফ্রেশ করতে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-10 px-4 sm:px-6 selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 text-white shadow-xl shadow-amber-500/20 border border-amber-400/30 mb-3 animate-pulse">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            NXV <span className="text-amber-400">SMS</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            অ্যাকাউন্ট অনুমোদনের অপেক্ষায় রয়েছে
          </p>
        </div>

        {/* Pending Card */}
        <div className="rounded-2xl border border-amber-500/40 bg-slate-900/90 p-5 sm:p-7 shadow-2xl shadow-amber-950/40 backdrop-blur-md">
          {/* Status Badge */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                Status: Pending Approval
              </span>
            </div>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/30">
              অপেক্ষমান
            </span>
          </div>

          {/* User Details */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between rounded-xl bg-slate-950/80 p-3 border border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-400">ইউজার নাম:</span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-white">
                {userProfile.displayName || 'NXV User'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-950/80 p-3 border border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-400">আপনার ইমেইল:</span>
              </div>
              <span className="text-xs sm:text-sm font-mono text-cyan-400">
                {userProfile.email}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-amber-950/30 p-3 border border-amber-500/30">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-amber-300">নির্বাচিত এজেন্ট:</span>
              </div>
              <span className="text-xs sm:text-sm font-mono font-bold text-white">
                {userProfile.agentEmail || 'Master Agent'}
              </span>
            </div>
          </div>

          {/* Explanation Alert */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 mb-5 text-xs text-amber-200/90 leading-relaxed flex items-start gap-2.5">
            <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">অ্যাকাউন্ট লক রয়েছে:</strong>
              আপনার নির্বাচিত এজেন্ট <span className="text-amber-300 font-mono font-bold">{userProfile.agentEmail || 'Agent'}</span> এই অ্যাকাউন্টটি অনুমোদন ও প্রতি ওটিপি রেট (৳০.৩০ - ৳০.৬০) নির্ধারণ না করা পর্যন্ত কোনো ভার্চুয়াল নাম্বার গ্রহণ বা ড্যাশবোর্ডের কাজ করা যাবে না। এজেন্ট অনুমোদন করার সাথে সাথে ড্যাশবোর্ড স্বয়ংক্রিয়ভাবে সচল হবে।
            </div>
          </div>

          {refreshMsg && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 mb-4 text-xs text-center text-amber-300 animate-fadeIn">
              {refreshMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleManualCheck}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 py-2.5 px-4 text-xs sm:text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 active:scale-98 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'চেক করা হচ্ছে...' : 'স্ট্যাটাস রিফ্রেশ করুন'}</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-2.5 px-4 text-xs sm:text-sm font-bold text-slate-300 hover:text-white transition-all active:scale-98"
            >
              <LogOut className="h-4 w-4" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>

        {/* Footer Guidance */}
        <div className="mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>দ্রুত অনুমোদনের জন্য আপনার এজেন্টের সাথে যোগাযোগ করুন</span>
        </div>
      </div>
    </div>
  );
};
