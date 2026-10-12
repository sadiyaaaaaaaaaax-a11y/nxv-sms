import React, { useState } from 'react';
import {
  History,
  Search,
  Filter,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  PhoneCall,
  Sparkles,
} from 'lucide-react';
import { SmsOrder } from '../types';

interface HistoryViewProps {
  orders: SmsOrder[];
  onSelectGetNumber: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ orders, onSelectGetNumber }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.otpCode && o.otpCode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'ALL' || o.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    if (orders.length === 0) return;
    const headers = ['Order ID,Phone Number,Service,Country,Range,Status,OTP,Date\n'];
    const rows = orders.map(
      (o) =>
        `"${o.id}","${o.phoneNumber}","${o.service}","${o.country}","${o.range}","${o.status}","${o.otpCode || ''}","${o.createdAt}"`
    );
    const blob = new Blob([...headers, rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nxv-sms-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-400" />
            <h1 className="text-xl sm:text-2xl font-black text-white">
              SMS &amp; OTP History / ইতিহাস
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            আপনার নেওয়া সকল ভার্চুয়াল নাম্বার এবং প্রাপ্ত OTP কোডের পূর্ণাঙ্গ রেকর্ড।
          </p>
        </div>

        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={onSelectGetNumber}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:brightness-110 transition-all"
          >
            <PhoneCall className="h-4 w-4" />
            <span>নতুন নাম্বার নিন</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by phone number, OTP, service..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'RECEIVED', 'WAITING', 'CANCELLED', 'EXPIRED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                filterStatus === st
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {st === 'ALL'
                ? 'All Orders'
                : st === 'RECEIVED'
                ? 'Received'
                : st === 'WAITING'
                ? 'Waiting'
                : st === 'CANCELLED'
                ? 'Cancelled'
                : 'Expired'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List / Table */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-500 mb-3">
            <History className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-white">কোনো হিস্ট্রি পাওয়া যায়নি</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || filterStatus !== 'ALL'
              ? 'আপনার সার্চ অনুযায়ী কোনো রেকর্ড মেলেনি।'
              : 'এখনও কোনো ভার্চুয়াল নাম্বার নেওয়া হয়নি। Get Number পেজ থেকে আপনার প্রথম নাম্বারটি সংগ্রহ করুন।'}
          </p>
          <button
            onClick={onSelectGetNumber}
            className="mt-4 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition-colors shadow-md shadow-cyan-950/60"
          >
            Get Number এ যান
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isReceived = order.status === 'RECEIVED';
            const isWaiting = order.status === 'WAITING';
            const isCancelled = order.status === 'CANCELLED';

            return (
              <div
                key={order.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 transition-all hover:border-slate-700 hover:bg-slate-900"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Number & Service */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                        isReceived
                          ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400'
                          : isWaiting
                          ? 'border-amber-500/40 bg-amber-950/30 text-amber-400'
                          : 'border-slate-800 bg-slate-950 text-slate-500'
                      }`}
                    >
                      {isReceived ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : isWaiting ? (
                        <Clock className="h-6 w-6 animate-pulse" />
                      ) : (
                        <XCircle className="h-6 w-6" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-base sm:text-lg font-black text-white select-all">
                          {order.phoneNumber}
                        </span>
                        <button
                          onClick={() => handleCopy(order.phoneNumber, `num-${order.id}`)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                          title="Copy Number"
                        >
                          {copiedId === `num-${order.id}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                          {order.service}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                        <span>{order.country}</span>
                        <span>•</span>
                        <span>Range: {order.range}</span>
                        <span>•</span>
                        <span>{new Date(order.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: OTP or Status */}
                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    {order.otpCode ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-1.5">
                        <div className="text-right">
                          <div className="text-[9px] uppercase font-bold text-emerald-400">
                            OTP Received
                          </div>
                          <div className="text-lg font-mono font-black text-white tracking-widest select-all">
                            {order.otpCode}
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopy(order.otpCode || '', `otp-${order.id}`)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/40 text-emerald-300 hover:bg-emerald-600/60 transition-colors"
                          title="Copy OTP"
                        >
                          {copiedId === `otp-${order.id}` ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`rounded-xl px-3 py-1.5 text-xs font-extrabold ${
                          isWaiting
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                            : isCancelled
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {order.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Full SMS Preview if available */}
                {order.fullMessage && (
                  <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-300 font-mono">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">
                      SMS Message:
                    </span>
                    {order.fullMessage}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
