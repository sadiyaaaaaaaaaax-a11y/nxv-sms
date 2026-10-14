import React from 'react';
import { XCircle, LogOut, Mail, User, ShieldAlert, HelpCircle } from 'lucide-react';
import { UserProfile } from '../lib/firebase';

interface RejectedAccountViewProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

export const RejectedAccountView: React.FC<RejectedAccountViewProps> = ({
  userProfile,
  onLogout,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-10 px-4 sm:px-6 selection:bg-rose-500/30 selection:text-rose-200">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-700 text-white shadow-xl shadow-rose-500/20 border border-rose-400/30 mb-3">
            <XCircle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            NXV <span className="text-rose-400">SMS</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            অ্যাকাউন্ট বাতিল / রিজেক্ট করা হয়েছে
          </p>
        </div>

        {/* Rejected Card */}
        <div className="rounded-2xl border border-rose-500/40 bg-slate-900/90 p-5 sm:p-7 shadow-2xl shadow-rose-950/40 backdrop-blur-md">
          {/* Status Badge */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
                Status: Rejected
              </span>
            </div>
            <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300 border border-rose-500/30">
              বাতিল
            </span>
          </div>

          {/* Details */}
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

            <div className="flex items-center justify-between rounded-xl bg-rose-950/20 p-3 border border-rose-500/30">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                <span className="text-xs text-rose-300">বাতিলের কারণ:</span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-rose-300 text-right">
                {userProfile.rejectionReason || 'এজেন্ট কর্তৃক আবেদন বাতিল করা হয়েছে'}
              </span>
            </div>
          </div>

          {/* Action */}
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 py-3 text-xs sm:text-sm font-bold text-white transition-all active:scale-98"
          >
            <LogOut className="h-4 w-4" />
            <span>লগআউট করুন</span>
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>পুনরায় রেজিস্ট্রেশন করতে সঠিক এজেন্টের সাথে যোগাযোগ করুন</span>
        </div>
      </div>
    </div>
  );
};
