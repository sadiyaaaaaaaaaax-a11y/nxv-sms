import React, { useState } from 'react';
import {
  Radio,
  Search,
  RefreshCw,
  Wifi,
  ArrowRight,
  TrendingUp,
  Globe,
} from 'lucide-react';
import { ActiveRange } from '../types';
import { detectCountryFromRange, normalizeServiceName } from '../lib/countryUtils';

interface ManageRangeViewProps {
  ranges: ActiveRange[];
  loading: boolean;
  onRefresh: () => void;
  onSelectRange: (range: string, service?: string) => void;
  apiSource: string;
}

export const ManageRangeView: React.FC<ManageRangeViewProps> = ({
  ranges,
  loading,
  onRefresh,
  onSelectRange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState('ALL');

  // Extract unique normalized services from ranges for filtering
  const servicesList = [
    'ALL',
    ...Array.from(
      new Set(
        ranges.map((r) => normalizeServiceName(r.service).displayName).filter(Boolean)
      )
    ),
  ];

  const filteredRanges = ranges.filter((r) => {
    const country = detectCountryFromRange(r.range);
    const norm = normalizeServiceName(r.service);

    const matchesSearch =
      r.range.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
      norm.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.tag && r.tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesService =
      selectedServiceFilter === 'ALL' || norm.displayName === selectedServiceFilter;

    return matchesSearch && matchesService;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 p-4 sm:p-6 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-black text-white">
              Manage Active Ranges / সক্রিয় নাম্বার রেঞ্জ
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-300">
            প্যানেলের রিয়েল-টাইম সক্রিয় নাম্বার রেঞ্জ, সার্ভিস এবং লাইভ হিট সংখ্যা।
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
            <span className="text-slate-500 mr-1.5">স্ট্যাটাস:</span>
            <span className="font-semibold text-emerald-400 capitalize">NXV Live Matrix</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-900/50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="রেঞ্জ, দেশ বা সার্ভিস খুঁজুন (যেমন: 237627XXX, Cameroon, Facebook)..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {servicesList.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedServiceFilter(s)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                selectedServiceFilter === s
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {s === 'ALL' ? 'All Services' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Ranges Grid or Empty State */}
      {filteredRanges.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 sm:p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 mb-3">
            <Radio className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">কোনো সক্রিয় রেঞ্জ তালিকা পাওয়া যায়নি</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            সার্চের সাথে মেলে এমন কোনো সক্রিয় রেঞ্জ পাওয়া যায়নি। ফিল্টার পরিবর্তন করুন বা Refresh চাপুন।
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-950/60"
            >
              {loading ? 'লোড হচ্ছে...' : 'পুনরায় চেক করুন (Refresh)'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredRanges.map((range) => {
            const country = detectCountryFromRange(range.range);
            const norm = normalizeServiceName(range.service);

            return (
              <div
                key={`${range.range}-${range.service}-${range.tag}-${range.hits}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 transition-all hover:border-emerald-500/40 hover:bg-slate-900 hover:shadow-lg hover:shadow-emerald-950/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg sm:text-xl font-black text-white group-hover:text-emerald-300 transition-colors">
                        {range.range}
                      </span>
                      <span className="text-base" title={country.name}>{country.flag}</span>
                    </div>

                    <div className="mt-1 text-xs text-slate-300 font-medium">
                      {country.name} ({country.dialCode})
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                      <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="truncate max-w-[130px]">{range.tag || 'Standard Route'}</span>
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-500/30 uppercase">
                    {norm.displayName}
                  </span>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-2.5 text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-slate-500 font-semibold">Service</div>
                    <div className="font-bold text-cyan-300 truncate">{norm.displayName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-slate-500 font-semibold">Live Hits</div>
                    <div className="flex items-center justify-end gap-1 font-bold text-emerald-400">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>{range.hits || 0} Hits</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                  <span className="text-[11px] text-slate-500 font-medium font-mono">
                    Active Route
                  </span>

                  <button
                    onClick={() => onSelectRange(range.range, range.service)}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600/30 px-3.5 py-1.5 text-xs font-bold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                  >
                    <span>নাম্বার নিন</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
