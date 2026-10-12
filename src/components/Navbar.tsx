import React from 'react';
import { Menu, Zap, LogOut, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react';
import { UserProfile } from '../lib/firebase';

interface NavbarProps {
  onToggleSidebar: () => void;
  userProfile: UserProfile | null;
  onLogout: () => void;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  userProfile,
  onLogout,
  onSelectTab,
}) => {
  const isAdmin = userProfile?.role === 'admin' || userProfile?.email === 'mnshiddik11@gmail.com';
  const isAgent = userProfile?.role === 'agent' || isAdmin || Boolean(userProfile?.email && userProfile.email.toLowerCase().includes('agent'));

  return (
    <header className="sticky top-0 z-30 border-b border-cyan-500/20 bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3">
        {/* Left: Hamburger & Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            aria-label="Open Navigation Menu"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 shadow-sm transition-all hover:bg-cyan-500/20 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div
            onClick={() => onSelectTab('getnum')}
            className="flex cursor-pointer items-center gap-2"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-500/25">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-black tracking-wider text-white">NXV</span>
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[11px] font-bold tracking-widest text-cyan-400 border border-cyan-500/30">
                  SMS
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 hidden md:block">
                Virtual SMS &amp; Live OTP Receiver
              </p>
            </div>
          </div>
        </div>

        {/* Center: Live Engine Indicator */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span>NXV Engine: Active</span>
        </div>

        {/* Right: User Profile, Admin & Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {userProfile && (
            <>
              {isAdmin && (
                <button
                  onClick={() => onSelectTab('admin')}
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-950/40 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900/50 transition-all shadow-sm"
                  title="এডমিন কন্ট্রোল প্যানেল"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                  <span className="hidden sm:inline">Admin Panel</span>
                </button>
              )}

              {/* Agent User Management Button */}
              {isAgent && (
                <button
                  onClick={() => onSelectTab('agent-users')}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-950/60 hover:bg-emerald-900/60 px-2.5 py-1.5 text-xs font-bold text-emerald-300 transition-all shadow-sm hover:shadow-emerald-950 cursor-pointer"
                  title="ইউজার ম্যানেজমেন্ট প্যানেল (এজেন্ট)"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">ইউজার ম্যানেজমেন্ট</span>
                  <span className="sm:hidden">Users</span>
                </button>
              )}
              {/* Quick Withdraw & Balance Button */}
              <button
                onClick={() => onSelectTab('withdraw')}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/50 px-2.5 py-1.5 text-xs font-bold text-amber-300 transition-all shadow-sm cursor-pointer"
                title="উইথড্র অপশন (বিকাশ, নগদ, Binance)"
              >
                <Wallet className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-mono">৳{(userProfile.balance || 0).toFixed(2)}</span>
                <span className="hidden sm:inline text-[10px] text-amber-200/90 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">উইথড্র</span>
              </button>

              <button
                onClick={() => onSelectTab('profile')}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-1 pl-2 text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800"
              >
                <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-cyan-600/30 text-cyan-300 font-semibold text-xs border border-cyan-500/30">
                  {userProfile.displayName ? userProfile.displayName[0].toUpperCase() : 'U'}
                </div>
                <span className="max-w-[90px] sm:max-w-[120px] truncate text-xs font-medium hidden xs:inline-block">
                  {userProfile.displayName}
                </span>
              </button>

              <button
                onClick={onLogout}
                className="flex items-center gap-1 rounded-xl border border-red-500/20 bg-red-950/20 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950/40 transition-colors"
                title="লগআউট"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">লগআউট</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
