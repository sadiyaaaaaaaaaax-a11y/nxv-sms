import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  Coins,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { UserProfile } from '../lib/firebase';
import { WithdrawMethod, WithdrawalRequest } from '../types';
import { fetchUserWithdrawals, requestWithdrawal } from '../lib/firebase';

interface WithdrawViewProps {
  userProfile: UserProfile | null;
  onBalanceUpdated?: (newBalance: number) => void;
  onLogAction?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export const WithdrawView: React.FC<WithdrawViewProps> = ({
  userProfile,
  onBalanceUpdated,
  onLogAction,
}) => {
  const [method, setMethod] = useState<WithdrawMethod>('bkash');
  const [accountType, setAccountType] = useState<'Personal' | 'Agent'>('Personal');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const availableBalance = userProfile?.balance || 0;

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadHistory = async () => {
    if (!userProfile?.id) return;
    setHistoryLoading(true);
    try {
      const list = await fetchUserWithdrawals(userProfile.id);
      setWithdrawals(list);
    } catch {
      // Ignored
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [userProfile?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.id) {
      showToast('অনুগ্রহ করে লগইন করুন', 'error');
      return;
    }

    const cleanAccount = accountNumber.trim();
    if (!cleanAccount) {
      showToast(method === 'binance' ? 'বাইনান্স পে আইডি / ইউআইডি প্রদান করুন' : 'সঠিক একাউন্ট নাম্বার প্রদান করুন', 'error');
      return;
    }

    const withdrawAmt = parseFloat(amount);
    if (isNaN(withdrawAmt) || withdrawAmt <= 0) {
      showToast('সঠিক উত্তোলনের পরিমাণ দিন', 'error');
      return;
    }

    if (withdrawAmt < 60) {
      showToast('সর্বনিম্ন উত্তোলন পরিমাণ ৳৬০.০০ (Minimum Withdraw ৳60)', 'error');
      return;
    }

    if (withdrawAmt > availableBalance) {
      showToast(`আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই (বর্তমান: ৳${availableBalance.toFixed(2)})`, 'error');
      return;
    }

    setLoading(true);
    try {
      const finalAccount =
        method === 'bkash' || method === 'nagad'
          ? `${cleanAccount} (${accountType})`
          : cleanAccount;

      const res = await requestWithdrawal({
        userId: userProfile.id,
        method,
        accountNumber: finalAccount,
        amount: withdrawAmt,
      });

      if (res.success && res.withdrawal) {
        showToast('উইথড্র রিকোয়েস্ট সফলভাবে জমা হয়েছে! এডমিন পর্যালোচনা করার পর উইথড্র সম্পন্ন হবে।', 'success');
        onLogAction?.(`User submitted withdraw request: ৳${withdrawAmt} via ${method.toUpperCase()}`, 'info');
        setAccountNumber('');
        setAmount('');
        if (typeof res.newBalance === 'number' && onBalanceUpdated) {
          onBalanceUpdated(res.newBalance);
        }
        setWithdrawals((prev) => [res.withdrawal, ...prev]);
      } else {
        showToast(res.message || 'উইথড্র রিকোয়েস্ট ব্যর্থ হয়েছে', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'সমস্যা হয়েছে', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Toast Alert */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-2xl text-xs sm:text-sm font-semibold border animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 shadow-emerald-950'
              : notification.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/50 shadow-rose-950'
              : 'bg-cyan-950/90 text-cyan-200 border-cyan-500/50 shadow-cyan-950'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header Banner & Balance */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 p-5 sm:p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-950/50 border border-amber-400/30">
              <Wallet className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                টাকা উত্তোলন (Withdraw Balance)
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                বিকাশ, নগদ অথবা বাইনান্সের মাধ্যমে সরাসরি আপনার অ্যাকাউন্টে টাকা উত্তোলন করুন
              </p>
            </div>
          </div>

          {/* Balance Pill */}
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-2.5 flex items-center justify-between sm:justify-start gap-3">
            <div>
              <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                উত্তোলনযোগ্য ব্যালেন্স
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                ৳{availableBalance.toFixed(2)}
              </div>
            </div>
            <Coins className="h-6 w-6 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Withdrawal Form Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 backdrop-blur-md shadow-xl">
        <h2 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <ArrowUpRight className="h-5 w-5 text-amber-400" />
          <span>নতুন উইথড্র রিকোয়েস্ট তৈরি করুন</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Method Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              পেমেন্ট মেথড নির্বাচন করুন (Select Method)
            </label>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {/* bKash */}
              <button
                type="button"
                onClick={() => setMethod('bkash')}
                className={`relative flex flex-col items-center justify-center rounded-xl p-3 border transition-all cursor-pointer ${
                  method === 'bkash'
                    ? 'border-pink-500 bg-pink-950/40 text-pink-200 ring-2 ring-pink-500/40 shadow-lg shadow-pink-950/40'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400 font-bold text-xs mb-1">
                  ৳
                </div>
                <span className="text-xs sm:text-sm font-black">বিকাশ (bKash)</span>
                <span className="text-[10px] text-pink-300/80 font-medium mt-0.5">Personal / Agent</span>
              </button>

              {/* Nagad */}
              <button
                type="button"
                onClick={() => setMethod('nagad')}
                className={`relative flex flex-col items-center justify-center rounded-xl p-3 border transition-all cursor-pointer ${
                  method === 'nagad'
                    ? 'border-orange-500 bg-orange-950/40 text-orange-200 ring-2 ring-orange-500/40 shadow-lg shadow-orange-950/40'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400 font-bold text-xs mb-1">
                  ৳
                </div>
                <span className="text-xs sm:text-sm font-black">নগদ (Nagad)</span>
                <span className="text-[10px] text-orange-300/80 font-medium mt-0.5">Personal / Agent</span>
              </button>

              {/* Binance */}
              <button
                type="button"
                onClick={() => setMethod('binance')}
                className={`relative flex flex-col items-center justify-center rounded-xl p-3 border transition-all cursor-pointer ${
                  method === 'binance'
                    ? 'border-amber-400 bg-amber-950/40 text-amber-200 ring-2 ring-amber-400/40 shadow-lg shadow-amber-950/40'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs mb-1">
                  ⚡
                </div>
                <span className="text-xs sm:text-sm font-black">Binance</span>
                <span className="text-[10px] text-amber-300/80 font-medium mt-0.5">Pay ID / UID</span>
              </button>
            </div>
          </div>

          {/* Account Number / Binance ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {method === 'binance'
                ? 'বাইনান্স পে আইডি অথবা ইউআইডি (Binance Pay ID / UID)'
                : `${method === 'bkash' ? 'বিকাশ' : 'নগদ'} একাউন্ট নাম্বার (Account Number)`}
            </label>
            <div className="relative">
              <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={
                  method === 'binance'
                    ? 'যেমন: 123456789 (Pay ID / UID)'
                    : 'যেমন: 017xxxxxxxx বা 019xxxxxxxx'
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Account Type (Personal / Agent) for bKash and Nagad */}
          {(method === 'bkash' || method === 'nagad') && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                একাউন্টের ধরন (Account Type)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType('Personal')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    accountType === 'Personal'
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 ring-1 ring-cyan-400'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  পার্সোনাল (Personal)
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('Agent')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    accountType === 'Agent'
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 ring-1 ring-cyan-400'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  এজেন্ট (Agent)
                </button>
              </div>
            </div>
          )}

          {/* Binance Rate Info */}
          {method === 'binance' && (
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-950/20 text-xs text-amber-300 flex items-center justify-between">
              <div>
                <span className="font-bold">USDT পরিমাণ:</span>{' '}
                <span className="font-mono text-sm font-black text-white">
                  ${(parseFloat(amount || '0') / 125).toFixed(2)} USDT
                </span>
              </div>
              <span className="text-[10px] text-amber-400/80">রেট: ~৳১২৫/USDT</span>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                উত্তোলনের পরিমাণ (মিনিমাম ৳৬০.০০)
              </label>
              <button
                type="button"
                onClick={() => setAmount(availableBalance.toFixed(2))}
                className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
              >
                সবটুকু (৳{availableBalance.toFixed(2)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-400">
                ৳
              </span>
              <input
                type="number"
                step="0.01"
                min="60"
                max={availableBalance}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="60.00"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white font-mono placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[60, 100, 150, 200, 300, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt.toFixed(2))}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:border-slate-700 hover:text-white transition-all cursor-pointer"
                >
                  ৳{amt}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              * সর্বনিম্ন উত্তোলন পরিমাণ ৬০ টাকা। বিকাশ, নগদ অথবা বাইনান্সে সহজে উত্তোলন করা যায়।
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || availableBalance <= 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-amber-950/50 hover:brightness-110 active:scale-98 transition-all disabled:opacity-40 cursor-pointer"
          >
            {loading ? (
              <span>অনুরোধ পাঠানো হচ্ছে...</span>
            ) : (
              <>
                <ArrowUpRight className="h-4 w-4" />
                <span>উইথড্র কনফার্ম করুন (Confirm Withdraw)</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Withdrawal History Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base sm:text-lg font-bold text-white">
              আপনার উইথড্র হিস্ট্রি (Withdrawal History)
            </h3>
          </div>
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>
        </div>

        {historyLoading ? (
          <div className="text-center py-8 text-xs text-slate-400">
            হিস্ট্রি লোড হচ্ছে...
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
            <Wallet className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              আপনি এখনো কোনো উইথড্র রিকোয়েস্ট করেননি। ওটিপি রিসিভ করে ব্যালেন্স জমা হলে তা উইথড্র করতে পারবেন।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="pb-2.5 font-bold">তারিখ</th>
                  <th className="pb-2.5 font-bold">মেথড</th>
                  <th className="pb-2.5 font-bold">একাউন্ট / আইডি</th>
                  <th className="pb-2.5 font-bold">পরিমাণ</th>
                  <th className="pb-2.5 font-bold text-right">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-800/20">
                    <td className="py-3 text-slate-300 font-mono text-[11px]">
                      {new Date(w.createdAt).toLocaleString('bn-BD', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          w.method === 'bkash'
                            ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                            : w.method === 'nagad'
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {w.method}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-200">
                      {w.accountNumber}
                    </td>
                    <td className="py-3 font-mono font-bold text-white">
                      ৳{w.amount.toFixed(2)}
                    </td>
                    <td className="py-3 text-right">
                      {w.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span>উইথড্র সফল হয়েছে</span>
                        </span>
                      ) : w.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
                          <Clock className="h-3 w-3 text-amber-400" />
                          <span>পেন্ডিং</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/40 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                          <XCircle className="h-3 w-3 text-rose-400" />
                          <span>বাতিল</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
