import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Ban,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Minus,
  Megaphone,
  Settings,
  DollarSign,
  Radio,
  CheckCircle2,
  Trash2,
  PhoneCall,
  Key,
  ExternalLink,
  Award,
  AlertTriangle,
  Zap,
  Check,
  Send,
  X,
  Clock,
  TrendingUp,
  Wallet,
  Copy,
} from 'lucide-react';
import {
  UserProfile,
  UserRole,
  fetchAllUsers,
  updateUserRole,
  toggleUserBan,
  setUserBalance,
  deleteUserAccount,
  createBroadcastAnnouncement,
  createUserRecord,
  subscribeToAllUsers,
  updateUserApproval,
  fetchUserWithdrawals,
  handleWithdrawalAdminAction,
  approveApiAccess,
  rejectApiAccess,
  revokeApiAccess,
  regenerateApiKey,
} from '../lib/firebase';
import { WithdrawalRequest } from '../types';
import { API } from '../lib/api';

interface AdminPanelViewProps {
  currentUser: UserProfile;
  onRefreshBroadcasts?: () => void;
  onLogAction?: (message: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  currentUser,
  onRefreshBroadcasts,
  onLogAction,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'users' | 'agents' | 'withdrawals' | 'api-requests' | 'broadcast' | 'settings'>('users');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState<boolean>(false);
  
  // API Requests Management state
  const [apiSearchQuery, setApiSearchQuery] = useState<string>('');
  const [apiFilterStatus, setApiFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [apiActionLoading, setApiActionLoading] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'agent' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');

  // Create User / Agent Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');
  const [newUserBalance, setNewUserBalance] = useState<string>('0.00');
  const [creatingUser, setCreatingUser] = useState<boolean>(false);

  // Modals state
  const [selectedUserForBalance, setSelectedUserForBalance] = useState<UserProfile | null>(null);
  const [balanceAmount, setBalanceAmount] = useState<string>('5.00');
  const [balanceOperation, setBalanceOperation] = useState<'add' | 'set'>('add');

  const [confirmBanUser, setConfirmBanUser] = useState<UserProfile | null>(null);
  const [banReasonInput, setBanReasonInput] = useState<string>('Policy violation');

  const [confirmRoleUser, setConfirmRoleUser] = useState<UserProfile | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>('agent');

  // Broadcast Publisher state
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastType, setBroadcastType] = useState<'INFO' | 'ALERT' | 'UPDATE' | 'RANGE_ADDED'>('INFO');
  const [publishingBroadcast, setPublishingBroadcast] = useState<boolean>(false);

  // Gateway Settings State
  const [zenexApiKey, setZenexApiKey] = useState<string>('');
  const [apiKeyMasked, setApiKeyMasked] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [gatewayTesting, setGatewayTesting] = useState<boolean>(false);
  const [gatewayTestResult, setGatewayTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Status message notification banner
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load real users from Firestore and Backend API - ZERO DEMO DATA
  const loadUsersList = async () => {
    setLoading(true);
    try {
      const list = await fetchAllUsers();
      // Ensure currently authenticated user is in the list
      const hasCurrent = currentUser?.id && list.some((u) => u.id === currentUser.id);
      const finalUsers = hasCurrent || !currentUser?.id ? list : [currentUser, ...list];
      setUsers(finalUsers);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setUsers(currentUser ? [currentUser] : []);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Zenex config
  const loadZenexConfig = async () => {
    try {
      const cfg = await API.getApiConfig();
      setApiKeyMasked(cfg.apiKeyMasked || '');
    } catch {}
  };

  // Handle Create New User / Agent directly
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) {
      showNotification('দয়া করে ইমেইল এড্রেস প্রদান করুন', 'error');
      return;
    }
    setCreatingUser(true);
    try {
      const created = await createUserRecord({
        displayName: newUserName.trim() || newUserEmail.trim().split('@')[0],
        email: newUserEmail.trim(),
        role: newUserRole,
        balance: parseFloat(newUserBalance) || 0,
      });

      if (created) {
        setUsers((prev) => [created, ...prev.filter((u) => u.id !== created.id)]);
        showNotification(
          newUserRole === 'agent'
            ? `নতুন এজেন্ট '${created.displayName}' সফলভাবে ডাটাবেজে তৈরি হয়েছে!`
            : `নতুন ইউজার '${created.displayName}' সফলভাবে ডাটাবেজে তৈরি হয়েছে!`
        );
        onLogAction?.(`Admin registered new ${newUserRole}: ${created.email}`, 'success');
        setShowCreateModal(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserRole('user');
        setNewUserBalance('0.00');
      }
    } catch (err: any) {
      showNotification(err.message || 'ইউজার তৈরিতে ত্রুটি হয়েছে', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  useEffect(() => {
    loadUsersList();
    loadZenexConfig();
    loadWithdrawals();

    // Realtime Firestore users listener
    const unsub = subscribeToAllUsers(
      (realtimeUsers) => {
        if (realtimeUsers && realtimeUsers.length > 0) {
          setUsers((prev) => {
            const map = new Map<string, UserProfile>();
            prev.forEach((u) => map.set(u.id, u));
            realtimeUsers.forEach((u) => map.set(u.id, u));
            if (currentUser?.id && !map.has(currentUser.id)) {
              map.set(currentUser.id, currentUser);
            }
            return Array.from(map.values());
          });
        }
      },
      (err) => console.warn('Realtime listener error:', err)
    );

    return () => {
      unsub();
    };
  }, [currentUser?.id]);

  // Update Zenex API Key
  const handleSaveApiKey = async () => {
    if (!zenexApiKey.trim()) return;
    setSavingConfig(true);
    try {
      const res = await API.updateApiKey(zenexApiKey.trim());
      if (res.success) {
        setApiKeyMasked(res.apiKeyMasked);
        setZenexApiKey('');
        showNotification('Zenex API Key সফলভাবে আপডেট করা হয়েছে!');
        onLogAction?.('Admin updated Zenex API key', 'success');
      } else {
        showNotification('API Key আপডেট ব্যর্থ হয়েছে', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error updating API Key', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Test Gateway Connection
  const handleTestGateway = async () => {
    setGatewayTesting(true);
    setGatewayTestResult(null);
    try {
      const res = await API.getActiveRanges();
      if (res.success && res.ranges && res.ranges.length > 0) {
        setGatewayTestResult({
          success: true,
          msg: `গেটওয়ে কানেকশন সফল! ${res.ranges.length} টি অ্যাক্টিভ রেঞ্জ পাওয়া গেছে।`,
        });
      } else {
        setGatewayTestResult({
          success: true,
          msg: 'গেটওয়ে কানেক্টেড এবং সচল আছে (কোনো সচল রেঞ্জ এই মুহূর্তে নেই)।',
        });
      }
    } catch (err: any) {
      setGatewayTestResult({
        success: false,
        msg: `কানেকশন ইরোর: ${err.message || 'Server did not respond'}`,
      });
    } finally {
      setGatewayTesting(false);
    }
  };

  // Handle Ban / Unban User
  const handleExecuteBanToggle = async () => {
    if (!confirmBanUser) return;
    const target = confirmBanUser;
    const nextBannedState = !target.isBanned;

    // Prevent banning master admin
    if (target.email === 'mnshiddik11@gmail.com') {
      showNotification('মাস্টার এডমিনকে ব্যান করা যাবে না!', 'error');
      setConfirmBanUser(null);
      return;
    }

    try {
      await toggleUserBan(target.id, nextBannedState, nextBannedState ? banReasonInput : '');
      setUsers((prev) =>
        prev.map((u) =>
          u.id === target.id
            ? { ...u, isBanned: nextBannedState, banReason: nextBannedState ? banReasonInput : '' }
            : u
        )
      );
      showNotification(
        nextBannedState
          ? `ইউজার '${target.displayName}' কে ব্যান করা হয়েছে।`
          : `ইউজার '${target.displayName}' কে আনব্যান (সচল) করা হয়েছে!`
      );
      onLogAction?.(
        `Admin ${nextBannedState ? 'banned' : 'unbanned'} user: ${target.email}`,
        nextBannedState ? 'warn' : 'success'
      );
    } catch (err: any) {
      showNotification(err.message || 'ব্যান স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে', 'error');
    } finally {
      setConfirmBanUser(null);
    }
  };

  // Handle Change Role (User / Agent / Admin)
  const handleExecuteRoleChange = async () => {
    if (!confirmRoleUser) return;
    const target = confirmRoleUser;

    // Prevent changing master admin role to non-admin
    if (target.email === 'mnshiddik11@gmail.com' && selectedNewRole !== 'admin') {
      showNotification('মাস্টার এডমিনের রোল পরিবর্তন করা যাবে না!', 'error');
      setConfirmRoleUser(null);
      return;
    }

    try {
      await updateUserRole(target.id, selectedNewRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, role: selectedNewRole } : u))
      );
      showNotification(
        `'${target.displayName}' এর রোল পরিবর্তন করে '${selectedNewRole.toUpperCase()}' করা হয়েছে!`
      );
      onLogAction?.(
        `User ${target.email} promoted/changed to ${selectedNewRole}`,
        'success'
      );
    } catch (err: any) {
      showNotification(err.message || 'রোল পরিবর্তন ব্যর্থ হয়েছে', 'error');
    } finally {
      setConfirmRoleUser(null);
    }
  };

  // Handle Balance Adjustment
  const handleExecuteBalanceAdjustment = async () => {
    if (!selectedUserForBalance) return;
    const target = selectedUserForBalance;
    const amount = parseFloat(balanceAmount);

    if (isNaN(amount) || amount < 0) {
      showNotification('সঠিক ব্যালেন্স পরিমাণ ইনপুট করুন', 'error');
      return;
    }

    const newBal =
      balanceOperation === 'add'
        ? Number(((target.balance || 0) + amount).toFixed(2))
        : Number(amount.toFixed(2));

    try {
      await setUserBalance(target.id, newBal);
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, balance: newBal } : u))
      );
      showNotification(
        `'${target.displayName}' এর নতুন ব্যালেন্স: $${newBal.toFixed(2)} সফলভাবে সেট করা হয়েছে!`
      );
      onLogAction?.(`Admin updated balance for ${target.email} to $${newBal}`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'ব্যালেন্স আপডেট ব্যর্থ হয়েছে', 'error');
    } finally {
      setSelectedUserForBalance(null);
    }
  };

  // Handle Delete User Doc
  const handleDeleteUser = async (target: UserProfile) => {
    if (target.email === 'mnshiddik11@gmail.com') {
      showNotification('মাস্টার এডমিন একাউন্ট ডিলিট করা সম্ভব নয়!', 'error');
      return;
    }

    if (!window.confirm(`আপনি কি নিশ্চিত যে '${target.displayName}' এর রেকর্ড মুছে ফেলতে চান?`)) {
      return;
    }

    try {
      await deleteUserAccount(target.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      showNotification(`ইউজার '${target.displayName}' সফলভাবে মুছে ফেলা হয়েছে!`);
      onLogAction?.(`Admin deleted user ${target.email}`, 'warn');
    } catch (err: any) {
      showNotification(err.message || 'ইউজার ডিলিট ব্যর্থ হয়েছে', 'error');
    }
  };

  // Handle Approve Pending User directly from Admin Panel
  const handleApprovePendingUser = async (target: UserProfile) => {
    try {
      const rate = target.perOtpRate && target.perOtpRate >= 0.30 ? target.perOtpRate : 0.40;
      await updateUserApproval(target.id, 'approved', rate);
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, status: 'approved', perOtpRate: rate } : u))
      );
      showNotification(`ইউজার '${target.displayName}' অনুমোদিত হয়েছে! রেট: ৳${rate.toFixed(2)}/OTP`);
      onLogAction?.(`Admin approved user ${target.email} at ৳${rate}/OTP`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'অনুমোদন ব্যর্থ হয়েছে', 'error');
    }
  };

  // Handle Reject Pending User directly from Admin Panel
  const handleRejectPendingUser = async (target: UserProfile) => {
    try {
      await updateUserApproval(target.id, 'rejected', 0, 'এডমিন কর্তৃক বাতিল');
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, status: 'rejected', rejectionReason: 'এডমিন কর্তৃক বাতিল' } : u))
      );
      showNotification(`ইউজার '${target.displayName}' এর আবেদন বাতিল করা হয়েছে`);
      onLogAction?.(`Admin rejected user ${target.email}`, 'warn');
    } catch (err: any) {
      showNotification(err.message || 'বাতিল করতে সমস্যা হয়েছে', 'error');
    }
  };

  // Withdrawals Management Logic
  const loadWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const list = await fetchUserWithdrawals();
      setWithdrawals(list);
    } catch {
      // Ignored
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  const handleApproveWithdrawal = async (w: WithdrawalRequest) => {
    try {
      const res = await handleWithdrawalAdminAction(w.id, 'approve', 'উইথড্র সফল হয়েছে');
      if (res.success && res.withdrawal) {
        setWithdrawals((prev) => prev.map((item) => (item.id === w.id ? res.withdrawal : item)));
        showNotification(`৳${w.amount} উইথড্র সফলভাবে অনুমোদন করা হয়েছে! (${w.method.toUpperCase()} - ${w.accountNumber})`);
        onLogAction?.(`Admin approved withdrawal #${w.id} of ৳${w.amount} for ${w.userEmail}`, 'success');
      } else {
        showNotification('অনুমোদন করতে সমস্যা হয়েছে', 'error');
      }
    } catch {
      showNotification('ইরোর হয়েছে', 'error');
    }
  };

  const handleRejectWithdrawal = async (w: WithdrawalRequest) => {
    const reason = window.prompt('উইথড্র বাতিল করার কারণ (ঐচ্ছিক):', 'তথ্য সঠিক নয়');
    if (reason === null) return;
    try {
      const res = await handleWithdrawalAdminAction(w.id, 'reject', reason || 'বাতিল করা হয়েছে');
      if (res.success && res.withdrawal) {
        setWithdrawals((prev) => prev.map((item) => (item.id === w.id ? res.withdrawal : item)));
        // Refund amount back to local user state
        setUsers((prev) =>
          prev.map((u) => (u.id === w.userId ? { ...u, balance: Number(((u.balance || 0) + w.amount).toFixed(2)) } : u))
        );
        showNotification(`উইথড্র বাতিল করা হয়েছে এবং ৳${w.amount} ইউজারের অ্যাকাউন্টে ফেরত দেওয়া হয়েছে।`);
        onLogAction?.(`Admin rejected withdrawal #${w.id} for ${w.userEmail}`, 'warn');
      } else {
        showNotification('বাতিল করতে সমস্যা হয়েছে', 'error');
      }
    } catch {
      showNotification('সমস্যা হয়েছে', 'error');
    }
  };

  // API Requests Management Handlers
  const handleApproveApiUser = async (u: UserProfile) => {
    setApiActionLoading(u.id);
    try {
      const res = await approveApiAccess(u.id, u);
      if (res.success && res.apiKey) {
        setUsers((prev) =>
          prev.map((item) =>
            item.id === u.id
              ? { ...item, apiAccessStatus: 'approved', apiKey: res.apiKey, rejectionReason: '' }
              : item
          )
        );
        showNotification(`ইউজার '${u.displayName}' এর API এক্সেস সফলভাবে অনুমোদিত হয়েছে!`);
        onLogAction?.(`Admin approved API access for user: ${u.email}`, 'success');
      } else {
        showNotification(res.message || 'API অনুমোদন করতে সমস্যা হয়েছে', 'error');
      }
    } catch {
      showNotification('ইরোর হয়েছে', 'error');
    } finally {
      setApiActionLoading(null);
    }
  };

  const handleRejectApiUser = async (u: UserProfile) => {
    const reason = window.prompt('API আবেদন বাতিল করার কারণ (ঐচ্ছিক):', 'এডমিন কর্তৃক আবেদন বাতিল');
    if (reason === null) return;
    setApiActionLoading(u.id);
    try {
      const res = await rejectApiAccess(u.id, reason, u);
      if (res.success) {
        setUsers((prev) =>
          prev.map((item) =>
            item.id === u.id
              ? { ...item, apiAccessStatus: 'rejected', rejectionReason: reason }
              : item
          )
        );
        showNotification(`ইউজার '${u.displayName}' এর API আবেদন বাতিল করা হয়েছে।`);
        onLogAction?.(`Admin rejected API request for user: ${u.email}`, 'warn');
      } else {
        showNotification(res.message || 'বাতিল করতে সমস্যা হয়েছে', 'error');
      }
    } catch {
      showNotification('সমস্যা হয়েছে', 'error');
    } finally {
      setApiActionLoading(null);
    }
  };

  const handleRevokeApiUser = async (u: UserProfile) => {
    if (!window.confirm(`আপনি কি নিশ্চিত ইউজার '${u.displayName}' এর API Key নিষ্ক্রিয় করতে চান?`)) return;
    setApiActionLoading(u.id);
    try {
      const res = await revokeApiAccess(u.id, u);
      if (res.success) {
        setUsers((prev) =>
          prev.map((item) =>
            item.id === u.id
              ? { ...item, apiAccessStatus: 'none', apiKey: '' }
              : item
          )
        );
        showNotification(`ইউজার '${u.displayName}' এর API Key সফলভাবে নিষ্ক্রিয় করা হয়েছে।`);
        onLogAction?.(`Admin revoked API key for user: ${u.email}`, 'warn');
      }
    } catch {
      showNotification('নিষ্ক্রিয় করতে সমস্যা হয়েছে', 'error');
    } finally {
      setApiActionLoading(null);
    }
  };

  const handleRegenerateApiUser = async (u: UserProfile) => {
    if (!window.confirm(`ইউজার '${u.displayName}' এর জন্য নতুন API Key তৈরি করতে চান? পূর্বের Key অকার্যকর হয়ে যাবে।`)) return;
    setApiActionLoading(u.id);
    try {
      const res = await regenerateApiKey(u.id, u);
      if (res.success && res.apiKey) {
        setUsers((prev) =>
          prev.map((item) =>
            item.id === u.id ? { ...item, apiKey: res.apiKey, apiAccessStatus: 'approved' } : item
          )
        );
        showNotification(`ইউজার '${u.displayName}' এর জন্য নতুন API Key তৈরি হয়েছে!`);
        onLogAction?.(`Admin regenerated API key for user: ${u.email}`, 'info');
      }
    } catch {
      showNotification('নতুন Key তৈরিতে সমস্যা হয়েছে', 'error');
    } finally {
      setApiActionLoading(null);
    }
  };

  // Publish Global Broadcast
  const handlePublishBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      showNotification('শিরোনাম ও বার্তা উভয়ই পূরণ করুন', 'error');
      return;
    }

    setPublishingBroadcast(true);
    try {
      const ok = await createBroadcastAnnouncement({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        type: broadcastType,
        authorId: currentUser.id,
      });

      if (ok) {
        showNotification('ব্রডকাস্ট ঘোষণা সফলভাবে সমগ্র ওয়েবসাইটে প্রকাশ করা হয়েছে!');
        setBroadcastTitle('');
        setBroadcastMessage('');
        onRefreshBroadcasts?.();
        onLogAction?.(`Admin published broadcast: ${broadcastTitle}`, 'success');
      } else {
        showNotification('ব্রডকাস্ট প্রকাশ করতে সমস্যা হয়েছে', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error publishing broadcast', 'error');
    } finally {
      setPublishingBroadcast(false);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalAgents = users.filter((u) => u.role === 'agent').length;
    const totalBanned = users.filter((u) => u.isBanned).length;
    const totalCirculation = users.reduce((sum, u) => sum + (u.balance || 0), 0);
    const totalNumbers = users.reduce((sum, u) => sum + (u.totalNumbers || 0), 0);
    const totalOtps = users.reduce((sum, u) => sum + (u.totalOtps || 0), 0);

    return {
      totalUsers,
      totalAgents,
      totalBanned,
      totalCirculation: totalCirculation.toFixed(2),
      totalNumbers,
      totalOtps,
    };
  }, [users]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      // Status filter
      if (statusFilter === 'active' && u.isBanned) return false;
      if (statusFilter === 'banned' && !u.isBanned) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = u.displayName?.toLowerCase().includes(q);
        const emailMatch = u.email?.toLowerCase().includes(q);
        const idMatch = u.id?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !idMatch) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  const agentsList = useMemo(() => {
    return users.filter((u) => u.role === 'agent');
  }, [users]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between rounded-xl p-3.5 shadow-lg border backdrop-blur-md animate-fade-in ${
            notification.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/80 text-emerald-200'
              : 'border-red-500/40 bg-red-950/80 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/40 via-slate-900 to-indigo-950/40 p-4 sm:p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-600 to-amber-600 text-white shadow-lg shadow-red-950/50 border border-red-400/30">
              <ShieldAlert className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  Admin Control Panel
                </h1>
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-red-400 border border-red-500/40">
                  Master Root
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                ইউজার ম্যানেজমেন্ট, এজেন্ট অনুমোদন, ব্যান/আনব্যান ও প্ল্যাটফর্ম কন্ট্রোল
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadUsersList}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>রিফ্রেশ ডাটা</span>
            </button>
          </div>
        </div>

        {/* System Analytics Stats Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold">Total Users</span>
              <Users className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-white">{stats.totalUsers}</div>
            <div className="text-[10px] text-slate-500">মোট নিবন্ধিত ইউজার</div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[11px] font-semibold">Agents</span>
              <Award className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-300">{stats.totalAgents}</div>
            <div className="text-[10px] text-emerald-500/80">অনুমোদিত এজেন্ট</div>
          </div>

          <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-3">
            <div className="flex items-center justify-between text-red-400 mb-1">
              <span className="text-[11px] font-semibold">Banned</span>
              <Ban className="h-3.5 w-3.5 text-red-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-red-400">{stats.totalBanned}</div>
            <div className="text-[10px] text-red-500/80">স্থগিত / ব্যান ইউজার</div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3">
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[11px] font-semibold">Circulation</span>
              <DollarSign className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-300">${stats.totalCirculation}</div>
            <div className="text-[10px] text-amber-500/80">ইউজার ব্যালেন্স</div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold">Numbers</span>
              <PhoneCall className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-white">{stats.totalNumbers}</div>
            <div className="text-[10px] text-slate-500">গৃহীত নাম্বার</div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold">OTPs</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-white">{stats.totalOtps}</div>
            <div className="text-[10px] text-slate-500">বিতরণকৃত ওটিপি</div>
          </div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'users'
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Users Management (ইউজার ও ব্যান)</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'agents'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Agents Hub (এজেন্ট ও প্রিভিলেজ)</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-bold">
            {stats.totalAgents}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'withdrawals'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Withdrawals (উইথড্র রিকোয়েস্ট)</span>
          {withdrawals.filter((w) => w.status === 'PENDING').length > 0 && (
            <span className="rounded-full bg-amber-500/30 text-amber-300 px-2 py-0.5 text-[10px] font-black border border-amber-500/40 animate-pulse">
              {withdrawals.filter((w) => w.status === 'PENDING').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('api-requests')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'api-requests'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Key className="h-4 w-4" />
          <span>API & Telegram Bot (এপিআই রিকোয়েস্ট)</span>
          {users.filter((u) => u.apiAccessStatus === 'pending').length > 0 && (
            <span className="rounded-full bg-purple-500/30 text-purple-300 px-2 py-0.5 text-[10px] font-black border border-purple-500/40 animate-pulse">
              {users.filter((u) => u.apiAccessStatus === 'pending').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'broadcast'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Megaphone className="h-4 w-4" />
          <span>Broadcast & Notice (ঘোষণা)</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'settings'
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Gateway & Platform Settings</span>
        </button>
      </div>

      {/* TAB 1: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="ইউজার খুঁজুন (নাম, ইমেইল অথবা UID দিয়ে)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Role filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 hidden md:inline">রোল:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-semibold text-slate-200 focus:border-red-500 focus:outline-none"
                >
                  <option value="all">সব রোল</option>
                  <option value="user">User (ইউজার)</option>
                  <option value="agent">Agent (এজেন্ট)</option>
                  <option value="admin">Admin (এডমিন)</option>
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 hidden md:inline">স্ট্যাটাস:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-semibold text-slate-200 focus:border-red-500 focus:outline-none"
                >
                  <option value="all">সব স্ট্যাটাস</option>
                  <option value="active">Active (সচল)</option>
                  <option value="banned">Banned (স্থগিত)</option>
                </select>
              </div>

              {/* Add User Button */}
              <button
                type="button"
                onClick={() => {
                  setNewUserRole('user');
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:from-red-500 hover:to-amber-500 transition-all shrink-0 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>+ নতুন ইউজার / এজেন্ট</span>
              </button>
            </div>
          </div>

          {/* Users Table / Card List */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
            {filteredUsers.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-slate-800 text-slate-400 border border-slate-700">
                  <Users className="h-6 w-6" />
                </div>
                <div className="text-white font-bold text-sm">
                  ডাটাবেজে কোনো ইউজার পাওয়া যায়নি
                </div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  বর্তমানে কোনো ফিল্টার্ড ইউজার নেই। আপনি সরাসরি নতুন ইউজার বা এজেন্ট তৈরি করতে পারেন।
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNewUserRole('user');
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:brightness-110 transition-all cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>নতুন ইউজার / এজেন্ট যুক্ত করুন</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">ইউজার ও ইমেইল</th>
                      <th className="px-3 py-3">রোল</th>
                      <th className="px-3 py-3">স্ট্যাটাস</th>
                      <th className="px-3 py-3">ব্যালেন্স</th>
                      <th className="px-3 py-3 text-center">নাম্বার / ওটিপি</th>
                      <th className="px-4 py-3 text-right">একশন ও ম্যানেজমেন্ট</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredUsers.map((u) => {
                      const isMasterAdmin = u.email === 'mnshiddik11@gmail.com';
                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            u.isBanned ? 'bg-red-950/10' : ''
                          }`}
                        >
                          {/* User Details */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs border ${
                                  u.role === 'admin'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                    : u.role === 'agent'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {u.displayName ? u.displayName[0].toUpperCase() : 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-white flex items-center gap-1.5 truncate">
                                  <span>{u.displayName || 'No Name'}</span>
                                  {isMasterAdmin && (
                                    <span className="rounded bg-red-500/20 px-1.5 py-0.2 text-[9px] font-black text-red-400 border border-red-500/30">
                                      Owner
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono truncate">
                                  {u.email}
                                </div>
                                {u.agentEmail && (
                                  <div className="text-[10px] text-emerald-400 font-medium truncate">
                                    Agent: {u.agentEmail} {u.perOtpRate ? `(৳${u.perOtpRate.toFixed(2)}/OTP)` : ''}
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-500 font-mono truncate">
                                  UID: {u.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            {u.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
                                <Shield className="h-3 w-3" />
                                <span>ADMIN</span>
                              </span>
                            ) : u.role === 'agent' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 shadow-sm shadow-emerald-950">
                                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                                <span>AGENT</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[10px] font-medium text-slate-300">
                                <UserCheck className="h-3 w-3 text-slate-400" />
                                <span>USER</span>
                              </span>
                            )}
                          </td>

                          {/* Status (Active / Banned / Pending) */}
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            {u.isBanned ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 border border-red-500/50 px-2.5 py-0.5 text-[10px] font-bold text-red-400 animate-pulse">
                                <Ban className="h-3 w-3" />
                                <span>BANNED</span>
                              </span>
                            ) : u.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/80 border border-amber-500/50 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                                <Clock className="h-3 w-3" />
                                <span>Pending</span>
                              </span>
                            ) : u.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/80 border border-rose-500/50 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                                <span>Rejected</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                <span>Active</span>
                              </span>
                            )}
                          </td>

                          {/* Balance */}
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <div className="font-mono font-bold text-white text-xs sm:text-sm">
                              ${(u.balance || 0).toFixed(2)}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedUserForBalance(u);
                                setBalanceAmount('5.00');
                                setBalanceOperation('add');
                              }}
                              className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-semibold mt-0.5"
                            >
                              <Plus className="h-2.5 w-2.5" />
                              <span>ব্যালেন্স এডিট</span>
                            </button>
                          </td>

                          {/* Activity metrics */}
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            <span className="text-xs font-bold text-slate-200">
                              {u.totalNumbers || 0}
                            </span>
                            <span className="text-slate-500 text-[10px] mx-1">/</span>
                            <span className="text-xs font-bold text-emerald-400">
                              {u.totalOtps || 0}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Pending Approval / Reject buttons */}
                              {u.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApprovePendingUser(u)}
                                    title="অ্যাকাউন্ট অনুমোদন করুন"
                                    className="flex items-center gap-1 rounded-lg bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-600/50 px-2.5 py-1.5 text-xs font-bold transition-all shadow-sm"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => handleRejectPendingUser(u)}
                                    title="আবেদন বাতিল করুন"
                                    className="flex items-center gap-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-500/40 hover:bg-rose-950/60 px-2 py-1.5 text-xs font-bold transition-all"
                                  >
                                    <X className="h-3.5 w-3.5 text-rose-400" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {/* Ban / Unban Button */}
                              <button
                                onClick={() => setConfirmBanUser(u)}
                                disabled={isMasterAdmin}
                                title={u.isBanned ? 'আনব্যান করুন' : 'ব্যান করুন'}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all disabled:opacity-30 ${
                                  u.isBanned
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                    : 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                                }`}
                              >
                                <Ban className="h-3.5 w-3.5" />
                                <span>{u.isBanned ? 'Unban' : 'Ban'}</span>
                              </button>

                              {/* Role button / dropdown trigger */}
                              <button
                                onClick={() => {
                                  setConfirmRoleUser(u);
                                  setSelectedNewRole(u.role === 'agent' ? 'user' : 'agent');
                                }}
                                disabled={isMasterAdmin}
                                title="রোল পরিবর্তন (User / Agent / Admin)"
                                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-slate-600 hover:text-white transition-all disabled:opacity-30"
                              >
                                <Award className="h-3.5 w-3.5 text-amber-400" />
                                <span>Role</span>
                              </button>

                              {/* Delete doc */}
                              {!isMasterAdmin && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  title="ইউজার মুছুন"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/20 bg-red-950/20 text-red-400 hover:bg-red-950/40 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AGENT MANAGEMENT */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          {/* Agent Program Banner */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Agent Privileges &amp; Wholesale Hub
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  এজেন্টদের বিশেষ সুবিধা দেওয়া হয় যেমন পাইকারি রেটে নাম্বার ক্রয়, বিশেষ ভিআইপি রেঞ্জের এক্সেস
                  এবং সরাসরি প্রায়োরিটি ওটিপি রিসিভ সাপোর্ট। আপনি যেকোনো সাধারণ ইউজারকে এক ক্লিকে এজেন্ট বানাতে পারবেন।
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setNewUserRole('agent');
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>+ নতুন এজেন্ট তৈরি করুন</span>
                </button>
                <span className="rounded-xl border border-emerald-500/30 bg-emerald-950/60 px-3.5 py-2 text-xs font-bold text-emerald-300">
                  সক্রিয় এজেন্ট: {agentsList.length} জন
                </span>
              </div>
            </div>
          </div>

          {/* Agents List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {agentsList.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-400 text-sm space-y-3">
                <div>এই মুহূর্তে কোনো এজেন্ট নির্ধারিত নেই। আপনি সরাসরি নতুন এজেন্ট তৈরি করতে পারেন অথবা ‘Users’ ট্যাব থেকে যেকোনো ইউজারকে ‘Role’ অপশন দিয়ে এজেন্ট বানাতে পারেন।</div>
                <button
                  type="button"
                  onClick={() => {
                    setNewUserRole('agent');
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>+ নতুন এজেন্ট যুক্ত করুন</span>
                </button>
              </div>
            ) : (
              agentsList.map((ag) => (
                <div
                  key={ag.id}
                  className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-4 shadow-lg backdrop-blur-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-bl from-emerald-500/10 to-transparent pointer-events-none" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-sm">
                        {ag.displayName ? ag.displayName[0].toUpperCase() : 'A'}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-1.5">
                          <span>{ag.displayName}</span>
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-[170px]">
                          {ag.email}
                        </div>
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-emerald-300 border border-emerald-500/30">
                      VERIFIED AGENT
                    </span>
                  </div>

                  {/* Agent Perks Display */}
                  <div className="my-3.5 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500">ব্যালেন্স</div>
                      <div className="font-mono font-bold text-amber-300">
                        ${(ag.balance || 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">নাম্বার</div>
                      <div className="font-bold text-white">{ag.totalNumbers || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">ওটিপি</div>
                      <div className="font-bold text-emerald-400">{ag.totalOtps || 0}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setSelectedUserForBalance(ag);
                        setBalanceAmount('20.00');
                        setBalanceOperation('add');
                      }}
                      className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>ব্যালেন্স যোগ</span>
                    </button>

                    <button
                      onClick={() => {
                        setConfirmRoleUser(ag);
                        setSelectedNewRole('user');
                      }}
                      className="text-xs font-semibold text-slate-400 hover:text-red-400 transition-colors"
                    >
                      ডিমোট (সাধারণ ইউজার করুন)
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: WITHDRAWALS MANAGEMENT */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-4 sm:space-y-5">
          {/* Top Banner */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-4 sm:p-5 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    উইথড্র রিকোয়েস্ট ম্যানেজমেন্ট (Withdrawal Approvals)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    বিকাশ, নগদ ও বাইনান্স উত্তোলন অনুরোধ পর্যালোচনা ও অনুমোদন করুন। অনুমোদন করলে ইউজারের অ্যাকাউন্টে দেখাবে &quot;উইথড্র সফল হয়েছে&quot;।
                  </p>
                </div>
              </div>

              <button
                onClick={loadWithdrawals}
                disabled={loadingWithdrawals}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-900/40 transition-all cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingWithdrawals ? 'animate-spin' : ''}`} />
                <span>রিফ্রেশ</span>
              </button>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-3 border-t border-slate-800">
              <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-medium">মোট রিকোয়েস্ট</span>
                <div className="text-base font-black text-white">{withdrawals.length} টি</div>
              </div>
              <div className="rounded-xl bg-amber-950/30 p-2.5 border border-amber-500/30">
                <span className="text-[10px] text-amber-300 font-medium">পেন্ডিং অনুরোধ</span>
                <div className="text-base font-black text-amber-300">
                  {withdrawals.filter((w) => w.status === 'PENDING').length} টি
                </div>
              </div>
              <div className="rounded-xl bg-emerald-950/30 p-2.5 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-300 font-medium">অনুমোদিত (সফল)</span>
                <div className="text-base font-black text-emerald-300">
                  {withdrawals.filter((w) => w.status === 'APPROVED').length} টি
                </div>
              </div>
              <div className="rounded-xl bg-rose-950/30 p-2.5 border border-rose-500/30">
                <span className="text-[10px] text-rose-300 font-medium">বাতিলকৃত</span>
                <div className="text-base font-black text-rose-300">
                  {withdrawals.filter((w) => w.status === 'REJECTED').length} টি
                </div>
              </div>
            </div>
          </div>

          {/* Withdrawals List Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 backdrop-blur-md shadow-xl">
            {loadingWithdrawals ? (
              <div className="text-center py-10 text-xs text-slate-400">
                উইথড্র ডাটা লোড হচ্ছে...
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
                কোনো উইথড্র রিকোয়েস্ট পাওয়া যায়নি। ইউজাররা উইথড্র রিকোয়েস্ট দিলে তা এখানে প্রদর্শিত হবে।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="pb-3 font-bold">তারিখ ও সময়</th>
                      <th className="pb-3 font-bold">ইউজার</th>
                      <th className="pb-3 font-bold">মেথড</th>
                      <th className="pb-3 font-bold">একাউন্ট / আইডি</th>
                      <th className="pb-3 font-bold">পরিমাণ</th>
                      <th className="pb-3 font-bold">স্ট্যাটাস</th>
                      <th className="pb-3 font-bold text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(w.createdAt).toLocaleString('bn-BD', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          <div className="font-bold text-white">{w.userName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{w.userEmail}</div>
                        </td>
                        <td className="py-3 whitespace-nowrap">
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
                        <td className="py-3 font-mono font-bold text-slate-200 whitespace-nowrap">
                          {w.accountNumber}
                        </td>
                        <td className="py-3 font-mono font-black text-amber-300 text-sm whitespace-nowrap">
                          ৳{w.amount.toFixed(2)}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          {w.status === 'APPROVED' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              <span>উইথড্র সফল হয়েছে</span>
                            </span>
                          ) : w.status === 'PENDING' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
                              <Clock className="h-3 w-3 text-amber-400" />
                              <span>পেন্ডিং অনুমোদন</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                              <X className="h-3 w-3 text-rose-400" />
                              <span>বাতিলকৃত</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {w.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveWithdrawal(w)}
                                className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
                                title="উইথড্র অনুমোদন করুন (টাকা পাঠানো সম্পন্ন)"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>অনুমোদন (Approve)</span>
                              </button>
                              <button
                                onClick={() => handleRejectWithdrawal(w)}
                                className="flex items-center gap-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 px-2 py-1.5 text-xs font-bold transition-all cursor-pointer"
                                title="উইথড্র বাতিল করুন (টাকা ইউজারের ব্যালেন্সে ফেরত যাবে)"
                              >
                                <X className="h-3.5 w-3.5 text-rose-400" />
                                <span>বাতিল (Reject)</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              {w.adminNote || 'প্রক্রিয়া সম্পন্ন'}
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
      )}

      {/* TAB: API & TELEGRAM BOT REQUESTS */}
      {activeTab === 'api-requests' && (
        <div className="space-y-4">
          {/* Header & Stats Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4">
              <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-1">
                <span>পেন্ডিং এপিআই আবেদন</span>
                <Clock className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-purple-200">
                {users.filter((u) => u.apiAccessStatus === 'pending').length}
              </div>
              <div className="text-[11px] text-purple-400/80 mt-1">অনুমোদনের অপেক্ষায় থাকা ইউজার</div>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
              <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold mb-1">
                <span>অনুমোদিত এপিআই ইউজার</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-200">
                {users.filter((u) => u.apiAccessStatus === 'approved').length}
              </div>
              <div className="text-[11px] text-emerald-400/80 mt-1">সক্রিয়ভাবে এপিআই ব্যবহারকারী</div>
            </div>

            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
              <div className="flex items-center justify-between text-indigo-300 text-xs font-semibold mb-1">
                <span>মোট এপিআই ও বট হিট</span>
                <TrendingUp className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-indigo-200">
                {users.reduce((acc, u) => acc + (u.apiHits || 0), 0)}
              </div>
              <div className="text-[11px] text-indigo-400/80 mt-1">টেলিগ্রাম বট ও এপিআই কল সংখ্যা</div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 backdrop-blur-md shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={apiSearchQuery}
                  onChange={(e) => setApiSearchQuery(e.target.value)}
                  placeholder="ইউজারনেম, ইমেইল বা API Key দিয়ে খুঁজুন..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto text-xs">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setApiFilterStatus(st)}
                    className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all ${
                      apiFilterStatus === st
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'all' ? 'সকল' : st === 'pending' ? 'পেন্ডিং' : st === 'approved' ? 'অনুমোদিত' : 'বাতিলকৃত'}
                  </button>
                ))}
              </div>
            </div>

            {/* API Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="pb-3 font-bold">ইউজার</th>
                    <th className="pb-3 font-bold">স্ট্যাটাস</th>
                    <th className="pb-3 font-bold">API Key</th>
                    <th className="pb-3 font-bold">বট হিট</th>
                    <th className="pb-3 font-bold">আবেদনের কারণ / তারিখ</th>
                    <th className="pb-3 font-bold text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users
                    .filter((u) => {
                      if (apiFilterStatus === 'pending' && u.apiAccessStatus !== 'pending') return false;
                      if (apiFilterStatus === 'approved' && u.apiAccessStatus !== 'approved') return false;
                      if (apiFilterStatus === 'rejected' && u.apiAccessStatus !== 'rejected') return false;
                      if (apiSearchQuery.trim()) {
                        const q = apiSearchQuery.toLowerCase();
                        const matchName = u.displayName?.toLowerCase().includes(q);
                        const matchEmail = u.email?.toLowerCase().includes(q);
                        const matchKey = u.apiKey?.toLowerCase().includes(q);
                        if (!matchName && !matchEmail && !matchKey) return false;
                      }
                      return true;
                    })
                    .map((u) => {
                      const isPending = u.apiAccessStatus === 'pending';
                      const isApproved = u.apiAccessStatus === 'approved';
                      const isLoading = apiActionLoading === u.id;

                      return (
                        <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 whitespace-nowrap">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{u.displayName}</span>
                              <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[9px] font-mono text-slate-400 uppercase">
                                {u.role}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </td>

                          <td className="py-3.5 whitespace-nowrap">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30 animate-pulse">
                                <Clock className="h-3 w-3" />
                                পেন্ডিং
                              </span>
                            ) : isApproved ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="h-3 w-3" />
                                অনুমোদিত
                              </span>
                            ) : u.apiAccessStatus === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                                <AlertTriangle className="h-3 w-3" />
                                বাতিলকৃত
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">
                                আবেদন নেই
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 whitespace-nowrap">
                            {u.apiKey ? (
                              <div className="flex items-center gap-1.5 font-mono text-[11px] text-purple-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 max-w-[200px]">
                                <span className="truncate">{u.apiKey}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(u.apiKey!);
                                    setCopiedKeyId(u.id);
                                    setTimeout(() => setCopiedKeyId(null), 2000);
                                  }}
                                  className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
                                  title="কপি করুন"
                                >
                                  {copiedKeyId === u.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">কোনো Key নেই</span>
                            )}
                          </td>

                          <td className="py-3.5 whitespace-nowrap font-mono font-bold text-white text-xs">
                            <span className="rounded bg-slate-950 px-2 py-1 border border-slate-800 text-emerald-400">
                              {u.apiHits || 0} hits
                            </span>
                          </td>

                          <td className="py-3.5 max-w-[220px]">
                            <div className="text-[11px] text-slate-300 truncate">
                              {u.apiRequestReason || 'বট ইন্টিগ্রেশন'}
                            </div>
                            {u.apiRequestDate && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                {new Date(u.apiRequestDate).toLocaleDateString('bn-BD')}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending ? (
                                <>
                                  <button
                                    onClick={() => handleApproveApiUser(u)}
                                    disabled={isLoading}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-xs font-bold shadow transition-all disabled:opacity-50 cursor-pointer"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    <span>অনুমোদন</span>
                                  </button>
                                  <button
                                    onClick={() => handleRejectApiUser(u)}
                                    disabled={isLoading}
                                    className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 px-2.5 py-1 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    <span>বাতিল</span>
                                  </button>
                                </>
                              ) : isApproved ? (
                                <>
                                  <button
                                    onClick={() => handleRegenerateApiUser(u)}
                                    disabled={isLoading}
                                    className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 text-[11px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                    title="নতুন Key তৈরি করুন"
                                  >
                                    Re-generate
                                  </button>
                                  <button
                                    onClick={() => handleRevokeApiUser(u)}
                                    disabled={isLoading}
                                    className="rounded-lg border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/40 text-rose-300 px-2 py-1 text-[11px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                    title="Key বাতিল করুন"
                                  >
                                    Revoke
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleApproveApiUser(u)}
                                  disabled={isLoading}
                                  className="flex items-center gap-1 rounded-lg border border-purple-500/40 bg-purple-950/30 hover:bg-purple-900/50 text-purple-200 px-2.5 py-1 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                >
                                  <Key className="h-3 w-3" />
                                  <span>Key ইস্যু করুন</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BROADCAST & ANNOUNCEMENTS */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Create Broadcast Form */}
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="h-5 w-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">
                নতুন ব্রডকাস্ট বার্তা পাঠান (লাইভ স্ট্রিম ও নোটিশ)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              এখানে দেওয়া ঘোষণা ওয়েবসাইট ব্রাউজ করা সমস্ত ব্যবহারকারী লাইভ কনসোল এবং নোটিফিকেশনে সাথে সাথে দেখতে পাবেন।
            </p>

            <form onSubmit={handlePublishBroadcast} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  নোটিশের ধরন (Notice Type):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['INFO', 'ALERT', 'UPDATE', 'RANGE_ADDED'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBroadcastType(type)}
                      className={`rounded-lg border py-2 text-xs font-bold transition-all ${
                        broadcastType === type
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  শিরোনাম (Title):
                </label>
                <input
                  type="text"
                  placeholder="উদাঃ 🔥 নতুন Bangladesh ও USA রেঞ্জ যুক্ত হয়েছে!"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  বার্তা / নোটিশ বিবরণ (Message Description):
                </label>
                <textarea
                  rows={4}
                  placeholder="বিস্তারিত বার্তা এখানে লিখুন..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={publishingBroadcast}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-cyan-950/40 hover:from-cyan-500 hover:to-indigo-500 transition-all disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span>{publishingBroadcast ? 'প্রকাশ হচ্ছে...' : 'লাইভ ঘোষণা প্রকাশ করুন'}</span>
              </button>
            </form>
          </div>

          {/* Broadcast Preview Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                লাইভ প্রিভিউ (Live Preview)
              </h4>

              <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-xl">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-black text-cyan-400 border border-cyan-500/30">
                    {broadcastType}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Just Now</span>
                </div>
                <h5 className="font-bold text-white text-sm mb-1">
                  {broadcastTitle || 'শিরোনাম এখানে প্রদর্শিত হবে...'}
                </h5>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {broadcastMessage || 'ব্যবহারকারীরা এই বার্তাটি দেখতে পাবেন।'}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                <p className="font-bold text-slate-300 mb-1">💡 নোটিশ টিপস:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                  <li>নতুন কোন কান্ট্রি বা রেঞ্জ আসলে ‘RANGE_ADDED’ সিলেক্ট করুন।</li>
                  <li>জরুরি মেইনটেন্যান্স থাকলে ‘ALERT’ সিলেক্ট করুন।</li>
                  <li>সব ইউজার এবং এজেন্টদের কাছে এই বার্তাটি তৎক্ষণাৎ পৌঁছাবে।</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GATEWAY & SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Zenex Network API Gateway Configuration
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                আপনার অফিসিয়াল Zenex API Key পরিবর্তন অথবা টেস্ট করতে পারেন।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                <div className="text-xs text-slate-400 mb-1">বর্তমান অ্যাক্টিভ API Key:</div>
                <div className="font-mono text-sm font-bold text-indigo-300 tracking-wider">
                  {apiKeyMasked || 'কোনো Key সেট করা নেই'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestGateway}
                  disabled={gatewayTesting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 py-3 text-xs font-bold text-emerald-300 hover:bg-emerald-950/60 transition-all disabled:opacity-50"
                >
                  <Radio className={`h-4 w-4 ${gatewayTesting ? 'animate-pulse' : ''}`} />
                  <span>{gatewayTesting ? 'টেস্টিং চলছে...' : 'গেটওয়ে সংযোগ পরীক্ষা (Ping)'}</span>
                </button>
              </div>
            </div>

            {gatewayTestResult && (
              <div
                className={`rounded-xl border p-3 text-xs font-medium ${
                  gatewayTestResult.success
                    ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
                    : 'border-red-500/30 bg-red-950/30 text-red-300'
                }`}
              >
                {gatewayTestResult.msg}
              </div>
            )}

            {/* Change API Key Input */}
            <div className="pt-3 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                নতুন Zenex API Key ইনপুট করুন:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="উদাঃ ZNX_PJVG9XBZ6NBSLIAIK884NZ4I"
                  value={zenexApiKey}
                  onChange={(e) => setZenexApiKey(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                />
                <button
                  onClick={handleSaveApiKey}
                  disabled={savingConfig || !zenexApiKey.trim()}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-indigo-500 transition-all disabled:opacity-40"
                >
                  {savingConfig ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BAN / UNBAN CONFIRMATION */}
      {confirmBanUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 border border-red-500/30">
                <Ban className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {confirmBanUser.isBanned ? 'আনব্যান কনফার্মেশন' : 'ইউজার ব্যান কনফার্মেশন'}
                </h3>
                <p className="text-xs text-slate-400">অ্যাকাউন্ট অ্যাক্সেস পরিবর্তন</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              আপনি কি নিশ্চিত যে আপনি{' '}
              <span className="font-bold text-white">
                {confirmBanUser.displayName} ({confirmBanUser.email})
              </span>{' '}
              কে {confirmBanUser.isBanned ? 'আনব্যান (পুনরায় সচল)' : 'স্থগিত / ব্যান'} করতে চান?
            </p>

            {!confirmBanUser.isBanned && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ব্যান করার কারণ (Ban Reason):
                </label>
                <input
                  type="text"
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setConfirmBanUser(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                বাতিল
              </button>
              <button
                onClick={handleExecuteBanToggle}
                className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md transition-all ${
                  confirmBanUser.isBanned
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {confirmBanUser.isBanned ? 'হ্যাঁ, আনব্যান করুন' : 'হ্যাঁ, ব্যান করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CHANGE ROLE (USER / AGENT / ADMIN) */}
      {confirmRoleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-indigo-500/40 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-indigo-400 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">ইউজার রোল পরিবর্তন</h3>
                <p className="text-xs text-slate-400">User / Agent / Admin নির্ধারণ</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-3">
              ইউজার: <span className="font-bold text-white">{confirmRoleUser.displayName}</span>
              <br />
              ইমেইল: <span className="font-mono text-slate-400">{confirmRoleUser.email}</span>
            </p>

            <div className="space-y-2 mb-4">
              <label className="block text-xs font-semibold text-slate-300">নতুন রোল সিলেক্ট করুন:</label>
              <div className="grid grid-cols-3 gap-2">
                {(['user', 'agent', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedNewRole(r)}
                    className={`rounded-xl border p-2.5 text-center text-xs font-bold transition-all ${
                      selectedNewRole === r
                        ? r === 'agent'
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : r === 'admin'
                          ? 'border-red-500 bg-red-500/20 text-red-300'
                          : 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="capitalize">{r}</div>
                    <div className="text-[9px] font-normal text-slate-500">
                      {r === 'agent' ? 'এজেন্ট' : r === 'admin' ? 'এডমিন' : 'ইউজার'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setConfirmRoleUser(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                বাতিল
              </button>
              <button
                onClick={handleExecuteRoleChange}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-all"
              >
                রোল সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: BALANCE ADJUSTMENT */}
      {selectedUserForBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-cyan-400 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">ইউজার ব্যালেন্স এডজাস্ট</h3>
                <p className="text-xs text-slate-400">টপ-আপ অথবা সরাসরি ব্যালেন্স সেট</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 mb-3 text-xs space-y-1">
              <div>
                <span className="text-slate-400">ইউজার:</span>{' '}
                <span className="font-bold text-white">{selectedUserForBalance.displayName}</span>
              </div>
              <div>
                <span className="text-slate-400">বর্তমান ব্যালেন্স:</span>{' '}
                <span className="font-bold font-mono text-emerald-400">
                  ${(selectedUserForBalance.balance || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBalanceOperation('add')}
                  className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                    balanceOperation === 'add'
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  + ব্যালেন্স যোগ করুন (Top-up)
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceOperation('set')}
                  className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                    balanceOperation === 'set'
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  সরাসরি নতুন ব্যালেন্স সেট
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  পরিমাণ (USD $):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-3 py-2.5 text-sm text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick amount shortcuts */}
              <div className="flex items-center gap-2">
                {['2.00', '5.00', '10.00', '25.00', '50.00'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBalanceAmount(amt)}
                    className="flex-1 rounded-lg border border-slate-800 bg-slate-950 py-1 text-[11px] font-mono text-slate-300 hover:border-slate-700 hover:text-white"
                  >
                    +${amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedUserForBalance(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                বাতিল
              </button>
              <button
                onClick={handleExecuteBalanceAdjustment}
                className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-all"
              >
                ব্যালেন্স কনফার্ম করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE NEW USER / AGENT DIRECTLY */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3 text-cyan-400 mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">নতুন ইউজার / এজেন্ট তৈরি করুন</h3>
                  <p className="text-xs text-slate-400">ডাটাবেজে সরাসরি নতুন একাউন্ট ও প্রিভিলেজ সেট করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  নাম (Display Name):
                </label>
                <input
                  type="text"
                  placeholder="যেমন: Rahim Telecom বা Hasan Ahmed"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs sm:text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ইমেইল এড্রেস (Email)*:
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs sm:text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  রোল নির্ধারণ (Role):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['user', 'agent', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewUserRole(r)}
                      className={`rounded-xl border p-2 text-center text-xs font-bold transition-all ${
                        newUserRole === r
                          ? r === 'agent'
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : r === 'admin'
                            ? 'border-red-500 bg-red-500/20 text-red-300'
                            : 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="capitalize">{r}</div>
                      <div className="text-[9px] font-normal text-slate-500">
                        {r === 'agent' ? 'এজেন্ট' : r === 'admin' ? 'এডমিন' : 'ইউজার'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  প্রাথমিক ব্যালেন্স (USD $):
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={newUserBalance}
                  onChange={(e) => setNewUserBalance(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs sm:text-sm text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {creatingUser ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <span>ইউজার সংরক্ষণ করুন</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
