import React from 'react';
import {
  PhoneCall,
  History,
  User,
  Radio,
  Terminal,
  X,
  Zap,
  LogOut,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { UserProfile } from '../lib/firebase';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  userProfile: UserProfile | null;
  onLogout: () => void;
  ordersCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  userProfile,
  onLogout,
  ordersCount,
}) => {
  if (!isOpen) return null;

  const isAdmin = userProfile?.role === 'admin' || userProfile?.email === 'mnshiddik11@gmail.com';
  const isAgent = userProfile?.role === 'agent' || isAdmin || Boolean(userProfile?.email && userProfile.email.toLowerCase().includes('agent'));

  const menuItems = [
    {
      id: 'getnum',
      label: 'Get Number',
      bengaliLabel: 'নাম্বার নিন ও ওটিপি',
      icon: PhoneCall,
      color: 'text-cyan-400',
      activeBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
      badge: 'Live',
    },
    {
      id: 'history',
      label: 'SMS History',
      bengaliLabel: 'এসএমএস হিস্ট্রি',
      icon: History,
      color: 'text-amber-400',
      activeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
      badge: ordersCount > 0 ? String(ordersCount) : undefined,
    },
    {
      id: 'ranges',
      label: 'Active Ranges',
      bengaliLabel: 'অ্যাক্টিভ রেঞ্জ ও রুট',
      icon: Radio,
      color: 'text-emerald-400',
      activeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      badge: 'Matrix',
    },
    {
      id: 'console',
      label: 'Live Stream',
      bengaliLabel: 'লাইভ এসএমএস স্ট্রিম',
      icon: Terminal,
      color: 'text-rose-400',
      activeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    },
    {
      id: 'profile',
      label: 'User Profile',
      bengaliLabel: 'ইউজার প্রোফাইল',
      icon: User,
      color: 'text-violet-400',
      activeBg: 'bg-violet-500/15 border-violet-500/30 text-violet-300',
    },
    {
      id: 'withdraw',
      label: 'Withdraw Balance',
      bengaliLabel: 'উইথড্র (বিকাশ, নগদ, Binance)',
      icon: Wallet,
      color: 'text-amber-400',
      activeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
      badge: 'উইথড্র',
    },
    ...(isAgent
      ? [
          {
            id: 'agent-users',
            label: 'User Management',
            bengaliLabel: 'ইউজার ম্যানেজমেন্ট',
            icon: ShieldCheck,
            color: 'text-emerald-400',
            activeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
            badge: 'Agent',
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            id: 'admin',
            label: 'Admin Panel',
            bengaliLabel: 'এডমিন কন্ট্রোল ও ইউজার',
            icon: ShieldAlert,
            color: 'text-red-400',
            activeBg: 'bg-red-500/15 border-red-500/30 text-red-300',
            badge: 'Admin',
          },
        ]
      : []),
  ];

  const handleItemClick = (id: string) => {
    onSelectTab(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div className="relative z-10 flex w-72 sm:w-80 max-w-[85vw] flex-col justify-between border-r border-cyan-500/20 bg-slate-950 p-4 sm:p-5 shadow-2xl shadow-cyan-950/40">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 sm:pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg sm:text-xl font-black tracking-wider text-white">NXV</h2>
                  <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-xs font-bold text-cyan-400 border border-cyan-500/30">
                    SMS
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Virtual SMS Panel</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* User Status */}
          {userProfile && (
            <div className="my-3 sm:my-4 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="text-xs font-bold text-white truncate">
                  {userProfile.displayName}
                </div>
                {userProfile.role === 'admin' ? (
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-black text-red-400 border border-red-500/30">
                    ADMIN
                  </span>
                ) : userProfile.role === 'agent' ? (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    AGENT
                  </span>
                ) : (
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 border border-slate-700">
                    USER
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate font-mono">
                {userProfile.email}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/80">
                <span className="text-slate-400">Balance:</span>
                <span className="font-mono font-bold text-emerald-400">৳{(userProfile.balance || 0).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Navigation Menu List */}
          <nav className="mt-2 space-y-1 sm:space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`group flex w-full items-center justify-between rounded-xl border px-3 py-2.5 sm:px-3.5 sm:py-3 text-left transition-all ${
                    isActive
                      ? `${item.activeBg} font-semibold shadow-sm`
                      : 'border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border transition-all ${
                        isActive
                          ? 'border-current bg-white/10'
                          : 'border-slate-800 bg-slate-900 group-hover:border-slate-700'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? 'text-current' : item.color}`} />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold tracking-wide">{item.label}</div>
                      <div className="text-[10px] sm:text-[11px] text-slate-400">{item.bengaliLabel}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {item.badge && (
                      <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        isActive ? 'translate-x-0.5 text-current' : 'text-slate-600 group-hover:text-slate-400'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/80 pt-3 sm:pt-4">
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-2 sm:py-2.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-950/40 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out / লগআউট</span>
          </button>
        </div>
      </div>
    </div>
  );
};
