import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  ChevronDown,
  Settings,
  Shield,
  DollarSign,
  FileText,
  LogOut,
  Building2,
  Bell,
  Camera,
  CheckCircle2,
  HardDrive,
  UsersRound,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationCenter } from './NotificationCenter';
import { PageId } from './Sidebar';
import { cn } from '../lib/utils';
import { normalizeRole } from '../lib/permissions';
import { dataService } from '../services/dataService';
import { isSupabaseConfigured } from '../lib/supabase';

export type SettingsSection = 'profile' | 'notifications' | 'security' | 'billing';

interface TopBarProps {
  user: any;
  activePage: string;
  onNavigate?: (page: PageId, settingsSection?: SettingsSection) => void;
  onUpdateUser?: (user: any) => void;
  onLogout?: () => void;
  children?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  activePage,
  onNavigate,
  onUpdateUser,
  onLogout,
  children,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setImgError(false);
  }, [user?.photo]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isMenuOpen) return;

      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || []
        );
        if (items.length === 0) return;

        event.preventDefault();
        const currentIndex = items.findIndex((el) => el === document.activeElement);
        const nextIndex =
          event.key === 'ArrowDown'
            ? (currentIndex + 1) % items.length
            : (currentIndex - 1 + items.length) % items.length;
        items[nextIndex]?.focus();
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const getPageTitle = (id: string) => {
    const titles: Record<string, string> = {
      dashboard: 'Financial Dashboard',
      analytics: 'Business Analytics',
      'data-sources': 'Data Sources',
      settings: 'System Settings',
      visualisation: 'Data Visualisation',
      import: 'Data Import',
      invoices: 'Invoice Management',
      expenses: 'Expense Tracking',
      budgets: 'Budget Planning',
      clients: 'Client Directory',
      team: 'Team & Access',
      security: 'Security & Privacy',
      accounts: 'Chart of Accounts',
      ledger: 'General Ledger',
      reconciliation: 'Bank Reconciliation',
      reports: 'Financial Reports',
      'jamaica-compliance': 'Jamaica Tax & Payroll',
      accounts_receivable: 'Accounts Receivable',
      accounts_payable: 'Accounts Payable',
    };
    return titles[id] || 'Dashboard';
  };

  const getInitials = (name?: string) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(user?.name);
  const settings = dataService.getSettings();
  const currency = settings?.currency || 'USD';
  const taxRate = settings?.tax_rate != null ? Number(settings.tax_rate) : 15;
  const isCloudSynced = isSupabaseConfigured && user?.authMode !== 'local' && Boolean(dataService.getActiveUserId());

  const handleNavigate = (page: PageId, settingsSection?: SettingsSection) => {
    setIsMenuOpen(false);
    onNavigate?.(page, settingsSection);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const updated = dataService.saveUser({ ...user, photo: dataUrl });
      if (updated) {
        onUpdateUser?.(updated);
      }
      setImgError(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSignOut = () => {
    setIsMenuOpen(false);
    onLogout?.();
  };

  const renderAvatarContent = (iconSize: number) => {
    if (user?.photo && !imgError) {
      return (
        <img
          src={user.photo}
          alt={user?.name || 'Profile'}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      );
    }
    if (initials) {
      return <span>{initials}</span>;
    }
    return <User size={iconSize} />;
  };

  return (
    <header className="flex items-center justify-between mb-8 sticky top-0 bg-slate-50/90 backdrop-blur-md z-30 py-4 border-b border-slate-200/70">
      <div className="flex flex-col">
        <h1 className="text-2xl sm:text-3xl font-black text-jamaica-black tracking-tighter uppercase leading-none">
          {getPageTitle(activePage)}
        </h1>
        <p className="text-[11px] text-slate-600 font-bold uppercase tracking-widest mt-1.5">
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {children}
          <NotificationCenter onNavigate={(page) => onNavigate?.(page)} />
        </div>

        {/* User Avatar Dropdown */}
        <div className="relative pl-4 border-l border-slate-200" ref={menuRef}>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label="Open account menu"
            className={cn(
              'flex items-center gap-3 p-1.5 pr-2.5 rounded-2xl transition-all border cursor-pointer',
              isMenuOpen
                ? 'bg-white border-brand-500 shadow-md ring-2 ring-brand-500/15'
                : 'border-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm'
            )}
          >
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-black text-jamaica-black uppercase tracking-tight leading-none max-w-[140px] truncate">
                {user?.name || 'Account'}
              </span>
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1 max-w-[140px] truncate">
                {normalizeRole(user?.role)}
              </span>
            </div>

            <div className="relative w-10 h-10 rounded-2xl bg-brand-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-brand-500/20 overflow-hidden shrink-0">
              {renderAvatarContent(20)}
            </div>

            <ChevronDown
              size={15}
              className={cn(
                'text-slate-600 transition-transform duration-200',
                isMenuOpen && 'rotate-180 text-brand-600'
              )}
            />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                role="menu"
                aria-label="Account menu"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden"
              >
                {/* User Summary Header with Quick Photo Update */}
                <div className="p-5 bg-slate-50 border-b border-slate-200 space-y-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="relative group shrink-0">
                      <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center text-white text-sm font-black shadow-md shadow-brand-500/20 overflow-hidden">
                        {renderAvatarContent(22)}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Update profile photo"
                        aria-label="Upload new profile photo"
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-black text-white flex items-center justify-center shadow-md hover:bg-brand-600 transition-colors cursor-pointer"
                      >
                        <Camera size={12} />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-black tracking-tight truncate">
                        {user?.name || 'User'}
                      </p>
                      {user?.email && (
                        <p className="text-xs text-slate-700 font-medium truncate">
                          {user.email}
                        </p>
                      )}
                      {user?.company && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-brand-700 uppercase tracking-wider truncate">
                          <Building2 size={11} className="shrink-0" />
                          <span className="truncate">{user.company}</span>
                        </div>
                      )}
                      {user?.plan && (
                        <p className="mt-1 text-[11px] font-semibold text-slate-800 truncate">
                          Plan: {user.plan}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Workspace & Tax Metadata Strip */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/80 text-[11px] font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-slate-800">
                      {isCloudSynced ? (
                        <>
                          <CheckCircle2 size={13} className="text-brand-600" />
                          Cloud Synced
                        </>
                      ) : (
                        <>
                          <HardDrive size={13} className="text-slate-700" />
                          Local Workspace
                        </>
                      )}
                    </span>
                    <span className="font-mono text-slate-800">
                      {currency} · {taxRate}% Tax
                    </span>
                  </div>
                </div>

                {/* Quick Navigation */}
                <div className="p-2 space-y-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleNavigate('settings', 'profile')}
                    className={cn(
                      'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer',
                      activePage === 'settings'
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-900 hover:bg-slate-50 hover:text-brand-700'
                    )}
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <Settings size={15} />
                    </div>
                    <div className="flex flex-col">
                      <span>Profile & Account</span>
                      <span className="text-[11px] font-medium text-slate-600">
                        Edit name, photo & company
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleNavigate('settings', 'billing')}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-900 hover:bg-slate-50 hover:text-brand-700 transition-all text-left cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <DollarSign size={15} />
                    </div>
                    <div className="flex flex-col">
                      <span>Billing & Tax Rates</span>
                      <span className="text-[11px] font-medium text-slate-600">
                        Currency, prefix & {taxRate}% default tax
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleNavigate('settings', 'notifications')}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-900 hover:bg-slate-50 hover:text-brand-700 transition-all text-left cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <Bell size={15} />
                    </div>
                    <div className="flex flex-col">
                      <span>Notification Preferences</span>
                      <span className="text-[11px] font-medium text-slate-600">
                        Budget overruns & invoice alerts
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleNavigate('team')}
                    className={cn(
                      'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer',
                      activePage === 'team'
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-900 hover:bg-slate-50 hover:text-brand-700'
                    )}
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <UsersRound size={15} />
                    </div>
                    <div className="flex flex-col">
                      <span>Team & Multi-User Access</span>
                      <span className="text-[11px] font-medium text-slate-600">
                        Manage members, roles & invites
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleNavigate('security')}
                    className={cn(
                      'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer',
                      activePage === 'security'
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-900 hover:bg-slate-50 hover:text-brand-700'
                    )}
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <Shield size={15} />
                    </div>
                    <div className="flex flex-col">
                      <span>Security & Privacy</span>
                      <span className="text-[11px] font-medium text-slate-600">
                        Password, 2FA & active sessions
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleNavigate('reports')}
                    className={cn(
                      'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer',
                      activePage === 'reports'
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-900 hover:bg-slate-50 hover:text-brand-700'
                    )}
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <FileText size={15} />
                    </div>
                    <div className="flex flex-col">
                      <span>Financial Reports</span>
                      <span className="text-[11px] font-medium text-slate-600">
                        P&L, Balance Sheet & Trial Balance
                      </span>
                    </div>
                  </button>
                </div>

                {/* Sign Out Footer */}
                {onLogout && (
                  <div className="p-2 border-t border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider text-rose-700 hover:bg-rose-50 transition-all text-left cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
                        <LogOut size={15} />
                      </div>
                      Sign Out
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
