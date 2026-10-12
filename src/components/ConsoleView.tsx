import React, { useState } from 'react';
import {
  Terminal,
  Radio,
  RefreshCw,
  Search,
  CheckCircle2,
  Activity,
  Globe,
} from 'lucide-react';
import { BroadcastItem, ConsoleLog } from '../types';

interface ConsoleViewProps {
  broadcasts: BroadcastItem[];
  onRefreshBroadcasts: () => void;
  logs: ConsoleLog[];
  onAddLog: (log: Omit<ConsoleLog, 'id' | 'timestamp'>) => void;
}

export const ConsoleView: React.FC<ConsoleViewProps> = ({
  broadcasts,
  onRefreshBroadcasts,
  logs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await onRefreshBroadcasts();
    setTimeout(() => setRefreshing(false), 600);
  };

  const filteredBroadcasts = broadcasts.filter((b) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      b.title.toLowerCase().includes(q) ||
      b.message.toLowerCase().includes(q) ||
      (b.time && b.time.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-950/40 via-slate-900 to-indigo-950/40 p-4 sm:p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-rose-400" />
              <h1 className="text-xl sm:text-2xl font-black text-white">
                Live Broadcast &amp; SMS Activity Feed
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              রিয়েল-টাইম গ্লোবাল এসএমএস ওটিপি সফলতার লাইভ নেটওয়ার্ক ফিড।
            </p>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-rose-500/30 bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-rose-300 hover:bg-rose-900/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Live Feed</span>
          </button>
        </div>
      </div>

      {/* Global Live Broadcast Feed */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs sm:text-sm font-bold text-white">
              Global Live SMS Stream (Real-Time Deliveries)
            </h2>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              Live
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="সার্ভিস বা নাম্বার খুঁজুন..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-rose-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2 sm:space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {filteredBroadcasts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 rounded-xl bg-slate-950/50">
              {searchTerm ? 'কোনো ফলাফল পাওয়া যায়নি' : 'লাইভ ফিড লোড হচ্ছে...'}
            </div>
          ) : (
            filteredBroadcasts.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 sm:p-4 transition-all hover:border-slate-700"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300 border border-emerald-500/30">
                      DELIVERED
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white">{b.title}</h3>
                  </div>
                  {b.time && (
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {b.time}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-slate-300 font-mono leading-relaxed break-words">
                  {b.message}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Terminal Telemetry Logs */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 sm:p-5 font-mono">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Real-time System Stream</span>
          </div>
          <span className="text-[10px] text-slate-500">Live Gateway Activity</span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto text-[11px]">
          {logs.slice(-15).map((l) => (
            <div key={l.id} className="flex items-start gap-2 leading-relaxed">
              <span className="text-slate-600 shrink-0">[{l.timestamp}]</span>
              <span
                className={`uppercase font-bold shrink-0 ${
                  l.type === 'success'
                    ? 'text-emerald-400'
                    : l.type === 'error'
                    ? 'text-rose-400'
                    : l.type === 'warn'
                    ? 'text-amber-400'
                    : 'text-cyan-400'
                }`}
              >
                {l.type}
              </span>
              <span className="text-slate-300 break-all">{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
