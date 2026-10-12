import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Coins,
  ShieldCheck,
  AlertCircle,
  Sliders,
  DollarSign,
  TrendingUp,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  Sparkles,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  UserProfile,
  fetchAllUsers,
  subscribeToAllUsers,
  updateUserApproval,
  updateUserOtpRate,
} from '../lib/firebase';

interface AgentManagementViewProps {
  currentAgent: UserProfile;
  onLogAction?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export const AgentManagementView: React.FC<AgentManagementViewProps> = ({
  currentAgent,
  onLogAction,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal / Action state for Approval with Rate
  const [selectedUserForApproval, setSelectedUserForApproval] = useState<UserProfile | null>(null);
  const [approvalOtpRate, setApprovalOtpRate] = useState<number>(0.40);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Modal / Action state for Reject
  const [selectedUserForReject, setSelectedUserForReject] = useState<UserProfile | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Modal / Action state for Rate Update
  const [selectedUserForRateEdit, setSelectedUserForRateEdit] = useState<UserProfile | null>(null);
  const [editOtpRate, setEditOtpRate] = useState<number>(0.40);
  const [isSubmittingRateEdit, setIsSubmittingRateEdit] = useState(false);

  const isAdmin = currentAgent.role === 'admin' || currentAgent.email.toLowerCase() === 'mnshiddik11@gmail.com';

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (err: any) {
      console.warn('Failed to load users for agent:', err);
      showToast('ইউজার তালিকা লোড করতে সমস্যা হয়েছে', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();

    // Setup realtime subscription with clean merge
    const unsubscribe = subscribeToAllUsers((liveUsers) => {
      if (liveUsers && liveUsers.length > 0) {
        setUsers((prev) => {
          const map = new Map<string, UserProfile>();
          prev.forEach((u) => map.set(u.id, u));
          liveUsers.forEach((u) => {
            const existing = map.get(u.id);
            map.set(u.id, existing ? { ...existing, ...u } : u);
          });
          return Array.from(map.values());
        });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Filter users relevant to this agent
  const agentUsers = useMemo(() => {
    const currentAgentEmail = currentAgent.email.toLowerCase().trim();
    const agentUsername = currentAgentEmail.split('@')[0];

    return users.filter((u) => {
      // Don't show the agent itself in their user management list
      if (u.id === currentAgent.id || u.email.toLowerCase() === currentAgentEmail) {
        return false;
      }

      // If user has agentEmail set to this agent (exact or username prefix)
      if (u.agentEmail) {
        const uAgent = u.agentEmail.toLowerCase().trim();
        if (uAgent === currentAgentEmail || uAgent === agentUsername) {
          return true;
        }
      }

      // If admin, show all non-admin users
      if (isAdmin) {
        return u.role !== 'admin';
      }

      return false;
    });
  }, [users, currentAgent, isAdmin]);

  // Statistics
  const stats = useMemo(() => {
    const total = agentUsers.length;
    const pending = agentUsers.filter((u) => u.status === 'pending').length;
    const approved = agentUsers.filter((u) => u.status === 'approved' || (!u.status && u.role !== 'admin')).length;
    const rejected = agentUsers.filter((u) => u.status === 'rejected').length;
    const totalOtps = agentUsers.reduce((sum, u) => sum + (u.totalOtps || 0), 0);
    const totalBalance = agentUsers.reduce((sum, u) => sum + (u.balance || 0), 0);

    return { total, pending, approved, rejected, totalOtps, totalBalance };
  }, [agentUsers]);

  // Filtered by Tab & Search
  const displayedUsers = useMemo(() => {
    return agentUsers.filter((u) => {
      // Tab filter
      if (activeTab === 'pending' && u.status !== 'pending') return false;
      if (activeTab === 'approved' && (u.status !== 'approved' && (u.status || u.role === 'admin'))) return false;
      if (activeTab === 'rejected' && u.status !== 'rejected') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = u.displayName?.toLowerCase().includes(q);
        const emailMatch = u.email?.toLowerCase().includes(q);
        const idMatch = u.id?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !idMatch) return false;
      }

      return true;
    });
  }, [agentUsers, activeTab, searchQuery]);

  // Open Approval Modal
  const openApprovalModal = (user: UserProfile) => {
    setSelectedUserForApproval(user);
    // User requested range 0.30 - 0.60
    setApprovalOtpRate(user.perOtpRate && user.perOtpRate >= 0.30 && user.perOtpRate <= 0.60 ? user.perOtpRate : 0.40);
  };

  // Confirm Approval with OTP Rate
  const handleConfirmApproval = async () => {
    if (!selectedUserForApproval) return;
    const rate = Number(Number(approvalOtpRate).toFixed(2));
    if (isNaN(rate) || rate < 0.30 || rate > 0.60) {
      showToast('প্রতি ওটিপি রেট অবশ্যই ০.৩০ থেকে ০.৬০ টাকার মধ্যে হতে হবে', 'error');
      return;
    }

    setIsSubmittingApproval(true);
    try {
      await updateUserApproval(selectedUserForApproval.id, 'approved', rate);

      // Local optimistic update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUserForApproval.id
            ? { ...u, status: 'approved', perOtpRate: rate, rejectionReason: '' }
            : u
        )
      );

      const msg = `ইউজার ${selectedUserForApproval.displayName || selectedUserForApproval.email} অনুমোদিত হয়েছে। ওটিপি রেট: ৳${rate.toFixed(2)}`;
      showToast(msg, 'success');
      onLogAction?.(msg, 'success');
      setSelectedUserForApproval(null);
    } catch (err: any) {
      showToast('অনুমোদন করতে ব্যর্থ হয়েছে: ' + (err.message || ''), 'error');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Open Reject Modal
  const openRejectModal = (user: UserProfile) => {
    setSelectedUserForReject(user);
    setRejectReason('');
  };

  // Confirm Rejection
  const handleConfirmReject = async () => {
    if (!selectedUserForReject) return;
    setIsSubmittingReject(true);
    try {
      const reason = rejectReason.trim() || 'এজেন্ট কর্তৃক আবেদন বাতিল করা হয়েছে';
      await updateUserApproval(selectedUserForReject.id, 'rejected', 0, reason);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUserForReject.id
            ? { ...u, status: 'rejected', rejectionReason: reason }
            : u
        )
      );

      const msg = `ইউজার ${selectedUserForReject.displayName || selectedUserForReject.email} বাতিল (Reject) করা হয়েছে`;
      showToast(msg, 'info');
      onLogAction?.(msg, 'warn');
      setSelectedUserForReject(null);
    } catch (err: any) {
      showToast('বাতিল করতে সমস্যা হয়েছে: ' + (err.message || ''), 'error');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Open Rate Edit Modal
  const openRateEditModal = (user: UserProfile) => {
    setSelectedUserForRateEdit(user);
    setEditOtpRate(user.perOtpRate && user.perOtpRate >= 0.30 ? user.perOtpRate : 0.40);
  };

  // Confirm Rate Edit
  const handleConfirmRateEdit = async () => {
    if (!selectedUserForRateEdit) return;
    const rate = Number(Number(editOtpRate).toFixed(2));
    if (isNaN(rate) || rate < 0.30 || rate > 0.60) {
      showToast('প্রতি ওটিপি রেট অবশ্যই ০.৩০ থেকে ০.৬০ টাকার মধ্যে হতে হবে', 'error');
      return;
    }

    setIsSubmittingRateEdit(true);
    try {
      await updateUserOtpRate(selectedUserForRateEdit.id, rate);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUserForRateEdit.id ? { ...u, perOtpRate: rate } : u
        )
      );

      const msg = `ইউজার ${selectedUserForRateEdit.displayName} এর ওটিপি রেট আপডেট করা হয়েছে: ৳${rate.toFixed(2)}`;
      showToast(msg, 'success');
      onLogAction?.(msg, 'success');
      setSelectedUserForRateEdit(null);
    } catch (err: any) {
      showToast('রেট আপডেট ব্যর্থ হয়েছে', 'error');
    } finally {
      setIsSubmittingRateEdit(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-2xl text-xs sm:text-sm font-semibold border animate-in fade-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 shadow-emerald-950'
              : notification.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/50 shadow-rose-950'
              : 'bg-cyan-950/90 text-cyan-200 border-cyan-500/50 shadow-cyan-950'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/40 p-5 sm:p-6 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  ইউজার ম্যানেজমেন্ট (Agent Panel)
                </h1>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  {isAdmin ? 'Master Admin' : 'Agent Access'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                এজেন্ট ইমেইল: <span className="font-mono text-emerald-300 font-bold">{currentAgent.email}</span> • পেন্ডিং একাউন্ট অনুমোদন ও ওটিপি ইনকাম রেট নির্ধারণ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={loadUsers}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>
          </div>
        </div>

        {/* Info Callout */}
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-slate-300 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-emerald-300">ওটিপি রেট ও এজেন্ট কমিশন পলিসি: </span>
            প্রতিটি ওটিপির মোট ম্যাক্স ইনকাম পুল হলো <strong className="text-white">৬০ পয়সা (৳০.৬০)</strong>। আপনি আপনার অধীনস্থ ইউজারদের <strong className="text-white">০.৩০ টাকা হতে ০.৬০ টাকা</strong> রেট দিতে পারেন। ৬০ পয়সার ভেতর ইউজারকে যত পয়সা দেবেন, <strong className="text-emerald-400">অবশিষ্ট যা বাঁচবে তা সরাসরি আপনার (এজেন্ট) ব্যালেন্সে ওটিপি কমিশন হিসেবে জমা হবে!</strong> (যেমন: ইউজারকে ৩০ পয়সা দিলে আপনার লাভ ৩০ পয়সা, ৪০ পয়সা দিলে আপনার লাভ ২০ পয়সা)। এছাড়া <strong className="text-white">এজেন্ট একাউন্ট নিজে ওটিপি রিসিভ করলে সরাসরি পাবেন ৫০ পয়সা (৳০.৫০)</strong>।
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">মোট অ্যাসাইন্ড ইউজার</span>
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.total}</div>
          <p className="text-[11px] text-slate-500 mt-1">আপনার অধীনে নিবন্ধিত একাউন্ট</p>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/15 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-300 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">পেন্ডিং অনুমোদন</span>
            <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-amber-400">{stats.pending}</div>
          <p className="text-[11px] text-amber-300/80 mt-1">অনুমোদনের অপেক্ষায় থাকা ইউজার</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-4">
          <div className="flex items-center justify-between text-emerald-300 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">এজেন্ট নিজস্ব ওটিপি রেট</span>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">৳০.৫০</div>
          <p className="text-[11px] text-emerald-300/80 mt-1">এজেন্ট নিজে ওটিপি পেলে ৫০ পয়সা</p>
        </div>

        <div className="rounded-2xl border border-violet-500/30 bg-violet-950/15 p-4">
          <div className="flex items-center justify-between text-violet-300 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">ম্যাক্স রেট পুল</span>
            <Coins className="h-4 w-4 text-violet-400" />
          </div>
          <div className="text-2xl font-black text-violet-300">৳০.৬০</div>
          <p className="text-[11px] text-violet-300/80 mt-1">৬০ পয়সা - ইউজার রেট = এজেন্টের লাভ</p>
        </div>
      </div>

      {/* Main Table and Filter Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        {/* Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-slate-950/40">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'pending'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>পেন্ডিং অনুমোদন</span>
              {stats.pending > 0 && (
                <span className="rounded-full bg-amber-500 text-slate-950 px-1.5 py-0.2 text-[10px] font-black ml-1">
                  {stats.pending}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('approved')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'approved'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span>অনুমোদিত ({stats.approved})</span>
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'rejected'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>বাতিলকৃত ({stats.rejected})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>সকল ইউজার ({stats.total})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] sm:min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ইউজারনেম বা ইমেইল দিয়ে খুঁজুন..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-bold">ইউজার তথ্য (User Details)</th>
                <th className="py-3.5 px-4 font-bold">স্ট্যাটাস (Status)</th>
                <th className="py-3.5 px-4 font-bold">প্রতি ওটিপি রেট</th>
                <th className="py-3.5 px-4 font-bold">মোট ওটিপি ও ব্যালেন্স</th>
                <th className="py-3.5 px-4 font-bold">নিবন্ধন তারিখ</th>
                <th className="py-3.5 px-4 font-bold text-right">পদক্ষেপ (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    ইউজার ডাটা লোড হচ্ছে...
                  </td>
                </tr>
              ) : displayedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-slate-600 opacity-50" />
                    কোনো ইউজার পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                displayedUsers.map((u) => {
                  const isPending = u.status === 'pending';
                  const isApproved = u.status === 'approved' || (!u.status && u.role !== 'admin');
                  const isRejected = u.status === 'rejected';

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-cyan-400 font-bold">
                            {u.displayName ? u.displayName.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate text-sm">
                              {u.displayName || 'Unnamed User'}
                            </div>
                            <div className="font-mono text-slate-400 text-[11px] truncate">
                              {u.email}
                            </div>
                            {isAdmin && u.agentEmail && (
                              <div className="text-[10px] text-emerald-400/80">
                                Agent: {u.agentEmail}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                            <Clock className="h-3 w-3 animate-spin" />
                            পেন্ডিং (Pending)
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                            <CheckCircle className="h-3 w-3" />
                            অনুমোদিত (Approved)
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-[11px] font-bold text-rose-300">
                              <XCircle className="h-3 w-3" />
                              বাতিল (Rejected)
                            </span>
                            {u.rejectionReason && (
                              <div className="text-[10px] text-rose-400/80 max-w-[140px] truncate" title={u.rejectionReason}>
                                কারণ: {u.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Per OTP Rate */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-sm text-cyan-300">
                            ৳{(u.perOtpRate !== undefined ? u.perOtpRate : 0.30).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400">/ OTP</span>
                        </div>
                        <div className="text-[10px] font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                          <span>এজেন্ট লাভ:</span>
                          <span className="font-mono">৳{Math.max(0, 0.60 - (u.perOtpRate !== undefined ? u.perOtpRate : 0.30)).toFixed(2)}</span>
                        </div>
                        {isApproved && (
                          <button
                            onClick={() => openRateEditModal(u)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-medium mt-0.5 block"
                          >
                            রেট পরিবর্তন করুন
                          </button>
                        )}
                      </td>

                      {/* Otps & Balance */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-emerald-400 text-sm">
                          ৳{(u.balance || 0).toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          মোট ওটিপি: <strong className="text-white">{u.totalOtps || 0}</strong>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span>
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => openApprovalModal(u)}
                                className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-950 hover:brightness-110 active:scale-95 transition-all"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                <span>অনুমোদন ও রেট</span>
                              </button>
                              <button
                                onClick={() => openRejectModal(u)}
                                className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 active:scale-95 transition-all"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span>বাতিল</span>
                              </button>
                            </>
                          ) : isApproved ? (
                            <button
                              onClick={() => openRateEditModal(u)}
                              className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-cyan-500 hover:text-cyan-300 transition-all"
                            >
                              <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                              <span>রেট সেট (৳০.৩০ - ০.৬০)</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => openApprovalModal(u)}
                              className="flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-all"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>পুনরায় অনুমোদন</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Approval & Set Rate (0.30 to 0.60 BDT) */}
      {selectedUserForApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900 p-5 sm:p-6 shadow-2xl shadow-emerald-950/60">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">ইউজার একাউন্ট অনুমোদন (Approval)</h3>
                <p className="text-xs text-slate-400">প্রতি ওটিপিতে ইউজারের আয় নির্ধারণ করুন</p>
              </div>
            </div>

            {/* User Summary */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 mb-4 space-y-1">
              <div className="text-xs font-semibold text-white">
                ইউজার: {selectedUserForApproval.displayName}
              </div>
              <div className="text-xs font-mono text-slate-400">
                ইমেইল: {selectedUserForApproval.email}
              </div>
            </div>

            {/* Rate Slider & Input */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-300">
                  প্রতি ওটিপি রেট (Per OTP Rate)
                </label>
                <div className="flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1">
                  <span className="text-xs font-mono font-black text-emerald-300">
                    ৳{approvalOtpRate.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-300">/ OTP</span>
                </div>
              </div>

              {/* Range Slider: min 0.30, max 0.60, step 0.01 */}
              <input
                type="range"
                min="0.30"
                max="0.60"
                step="0.01"
                value={approvalOtpRate}
                onChange={(e) => setApprovalOtpRate(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />

              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>সর্বনিম্ন: ৳০.৩০</span>
                <span>বর্তমান: ৳{approvalOtpRate.toFixed(2)}</span>
                <span>সর্বোচ্চ: ৳০.৬০</span>
              </div>

              {/* Direct numeric buttons */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                {[0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setApprovalOtpRate(r)}
                    className={`rounded-lg py-1.5 text-xs font-bold border transition-all ${
                      Math.abs(approvalOtpRate - r) < 0.001
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    ৳{r.toFixed(2)}
                  </button>
                ))}
              </div>

              {/* Live Earnings & Agent Commission Breakdown */}
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">ইউজার পাবে</div>
                  <div className="text-xl font-black font-mono text-white">৳{approvalOtpRate.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-400">প্রতি ওটিপিতে ইউজারের ইনকাম</div>
                </div>
                <div className="border-l border-slate-800 pl-3 space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">আপনার লাভ (কমিশন)</div>
                  <div className="text-xl font-black font-mono text-emerald-300">
                    ৳{Math.max(0, 0.60 - approvalOtpRate).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-emerald-400/80">৬০ পয়সার বাকি অবশিষ্ট লাভ</div>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/30">
                💡 <strong>কমিশন হিসাব:</strong> ম্যাক্স ইনকাম ৬০ পয়সা। ইউজারকে <strong>৳{approvalOtpRate.toFixed(2)}</strong> দিলে প্রতি সফল ওটিপিতে আপনার একাউন্টে <strong>৳{Math.max(0, 0.60 - approvalOtpRate).toFixed(2)}</strong> স্বয়ংক্রিয়ভাবে ক্রেডিট হবে।
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedUserForApproval(null)}
                disabled={isSubmittingApproval}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isSubmittingApproval}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{isSubmittingApproval ? 'অনুমোদন হচ্ছে...' : 'অনুমোদন নিশ্চিত করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reject Request */}
      {selectedUserForReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-900 p-5 sm:p-6 shadow-2xl shadow-rose-950/60">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">ইউজার একাউন্ট বাতিল (Reject)</h3>
                <p className="text-xs text-slate-400">অনুরোধটি বাতিল করার কারণ লিখুন</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 mb-4 space-y-1">
              <div className="text-xs font-semibold text-white">
                ইউজার: {selectedUserForReject.displayName}
              </div>
              <div className="text-xs font-mono text-slate-400">
                ইমেইল: {selectedUserForReject.email}
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <label className="text-xs font-semibold text-slate-300">
                বাতিলের কারণ (Optional Reason):
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="যেমন: ভুল এজেন্ট ইমেইল অথবা অনাকাঙ্ক্ষিত আবেদন..."
                rows={3}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-rose-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedUserForReject(null)}
                disabled={isSubmittingReject}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                ফিরে যান
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isSubmittingReject}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-950 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                <span>{isSubmittingReject ? 'বাতিল হচ্ছে...' : 'বাতিল নিশ্চিত করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Update Existing User OTP Rate */}
      {selectedUserForRateEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 sm:p-6 shadow-2xl shadow-cyan-950/60">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">ওটিপি রেট পরিবর্তন (Update OTP Rate)</h3>
                <p className="text-xs text-slate-400">ইউজারের প্রতি ওটিপি আয় আপডেট করুন</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 mb-4 space-y-1">
              <div className="text-xs font-semibold text-white">
                ইউজার: {selectedUserForRateEdit.displayName}
              </div>
              <div className="text-xs font-mono text-slate-400">
                ইমেইল: {selectedUserForRateEdit.email}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-cyan-300">
                  নতুন প্রতি ওটিপি রেট
                </label>
                <div className="flex items-center gap-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-1">
                  <span className="text-xs font-mono font-black text-cyan-300">
                    ৳{editOtpRate.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-300">/ OTP</span>
                </div>
              </div>

              <input
                type="range"
                min="0.30"
                max="0.60"
                step="0.01"
                value={editOtpRate}
                onChange={(e) => setEditOtpRate(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />

              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>সর্বনিম্ন: ৳০.৩০</span>
                <span>বর্তমান: ৳{editOtpRate.toFixed(2)}</span>
                <span>সর্বোচ্চ: ৳০.৬০</span>
              </div>

              {/* Direct numeric buttons */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                {[0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEditOtpRate(r)}
                    className={`rounded-lg py-1.5 text-xs font-bold border transition-all ${
                      Math.abs(editOtpRate - r) < 0.001
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    ৳{r.toFixed(2)}
                  </button>
                ))}
              </div>

              {/* Live Earnings & Agent Commission Breakdown */}
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">ইউজার পাবে</div>
                  <div className="text-xl font-black font-mono text-white">৳{editOtpRate.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-400">প্রতি ওটিপিতে ইউজারের আয়</div>
                </div>
                <div className="border-l border-slate-800 pl-3 space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">আপনার লাভ (কমিশন)</div>
                  <div className="text-xl font-black font-mono text-emerald-300">
                    ৳{Math.max(0, 0.60 - editOtpRate).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-emerald-400/80">৬০ পয়সার বাকি অবশিষ্ট লাভ</div>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed bg-cyan-950/20 p-2.5 rounded-lg border border-cyan-500/30">
                💡 <strong>কমিশন হিসাব:</strong> ম্যাক্স ইনকাম ৬০ পয়সা। ইউজারকে <strong>৳{editOtpRate.toFixed(2)}</strong> দিলে প্রতি সফল ওটিপিতে আপনার একাউন্টে <strong>৳{Math.max(0, 0.60 - editOtpRate).toFixed(2)}</strong> কমিশন হিসেবে জমা হবে।
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedUserForRateEdit(null)}
                disabled={isSubmittingRateEdit}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleConfirmRateEdit}
                disabled={isSubmittingRateEdit}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-950 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{isSubmittingRateEdit ? 'সংরক্ষণ হচ্ছে...' : 'রেট আপডেট করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
