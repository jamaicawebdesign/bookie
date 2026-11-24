import { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Key, 
  Smartphone, 
  Monitor, 
  History, 
  Bell, 
  Lock,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  LogOut,
  Search,
  Download,
  Activity,
  Info,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { dataService } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLogCategory, AuditLogEntry } from '../types';
import { cn, formatLocalDate, sanitizeCsvCell } from '../lib/utils';

type SecurityTab = 'security' | 'audit';
type AuditCategoryFilter = 'All' | AuditLogCategory;

export function SecuritySettingsPage() {
  const [activeTab, setActiveTab] = useState<SecurityTab>('security');
  const [settings, setSettings] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategory, setAuditCategory] = useState<AuditCategoryFilter>('All');
  const [showAllAudit, setShowAllAudit] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [showFullHistory, setShowFullHistory] = useState(false);

  useEffect(() => {
    const loadSettings = () => {
      const data = dataService.getSecuritySettings();
      setSettings(data);
      setAuditLogs(dataService.getAuditLogs());
    };
    loadSettings();
    window.addEventListener('island-data-synced', loadSettings);
    return () => window.removeEventListener('island-data-synced', loadSettings);
  }, []);

  const canManageSecurity = dataService.can('manage_security');

  const handleToggle2FA = () => {
    if (!canManageSecurity) {
      setMessage({ text: 'Only workspace Owners can change 2FA policy settings.', type: 'error' });
      return;
    }
    const updated = { ...settings, twoFactorEnabled: !settings.twoFactorEnabled };
    setSettings(updated);
    dataService.saveSecuritySettings(updated);
    dataService.recordAuditLog({
      category: 'Security',
      action: updated.twoFactorEnabled ? '2FA enabled' : '2FA disabled',
      details: `Two-factor authentication turned ${updated.twoFactorEnabled ? 'on' : 'off'}`,
      status: updated.twoFactorEnabled ? 'Success' : 'Warning',
    });
    setMessage({ 
      text: `Two-factor authentication ${updated.twoFactorEnabled ? 'enabled' : 'disabled'} successfully.`, 
      type: 'success' 
    });
  };

  const handleToggleAlerts = () => {
    if (!canManageSecurity) {
      setMessage({ text: 'Only workspace Owners can change login notification policies.', type: 'error' });
      return;
    }
    const updated = { ...settings, loginAlerts: !settings.loginAlerts };
    setSettings(updated);
    dataService.saveSecuritySettings(updated);
    dataService.recordAuditLog({
      category: 'Security',
      action: updated.loginAlerts ? 'Login alerts enabled' : 'Login alerts disabled',
      details: `Email alerts for new sign-ins turned ${updated.loginAlerts ? 'on' : 'off'}`,
      status: 'Info',
    });
  };

  const handleSessionTimeoutChange = (minutes: number) => {
    if (!canManageSecurity) {
      setMessage({ text: 'Only workspace Owners can update session timeout policy.', type: 'error' });
      return;
    }
    const updated = { ...settings, sessionTimeout: minutes };
    setSettings(updated);
    dataService.saveSecuritySettings(updated);
    dataService.recordAuditLog({
      category: 'Security',
      action: 'Session timeout policy updated',
      details:
        minutes > 0
          ? `Inactivity auto-lock set to ${minutes} minutes`
          : 'Inactivity auto-lock disabled',
      status: minutes > 0 ? 'Success' : 'Warning',
    });
    setMessage({
      text:
        minutes > 0
          ? `Auto-lock session timeout updated to ${minutes} minutes.`
          : 'Inactivity auto-lock disabled.',
      type: 'success',
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new.length < 8 || !/[A-Z]/.test(passwordData.new) || !/[0-9]/.test(passwordData.new)) {
      setMessage({
        text: 'New password must be at least 8 characters and include an uppercase letter and a number.',
        type: 'error',
      });
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      setMessage({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    const currentUser = dataService.getUser();
    if (isSupabaseConfigured && supabase && currentUser?.authMode !== 'local') {
      const { error } = await supabase.auth.updateUser({ password: passwordData.new });
      if (error) {
        setMessage({ text: error.message || 'Failed to update password.', type: 'error' });
        return;
      }
    } else if (currentUser?.password && currentUser.password !== passwordData.current) {
      setMessage({ text: 'Current password does not match your local account.', type: 'error' });
      return;
    } else if (currentUser?.authMode === 'local') {
      const users = dataService.getUsers().map((u: any) =>
        u.email?.toLowerCase() === currentUser.email?.toLowerCase()
          ? { ...u, password: passwordData.new }
          : u
      );
      dataService.saveUsers(users);
      dataService.saveUser({ ...currentUser, password: passwordData.new });
    }

    const updated = { ...settings, lastPasswordChange: new Date().toISOString() };
    setSettings(updated);
    dataService.saveSecuritySettings(updated);
    dataService.recordAuditLog({
      category: 'Security',
      action: 'Password updated',
      details: 'Account login password was changed',
      status: 'Success',
    });
    setIsChangingPassword(false);
    setPasswordData({ current: '', new: '', confirm: '' });
    setMessage({ text: 'Password updated successfully.', type: 'success' });
  };

  const handleTerminateSession = (sessionId: string) => {
    if (!canManageSecurity) {
      setMessage({ text: 'Only workspace Owners can revoke active device sessions.', type: 'error' });
      return;
    }
    const target = settings.activeSessions.find((s: any) => s.id === sessionId);
    const updated = { 
      ...settings, 
      activeSessions: settings.activeSessions.filter((s: any) => s.id !== sessionId) 
    };
    setSettings(updated);
    dataService.saveSecuritySettings(updated);
    dataService.recordAuditLog({
      category: 'Security',
      action: 'Session terminated',
      details: target ? `Revoked active session on ${target.device}` : `Revoked session ${sessionId}`,
      status: 'Warning',
    });
    setMessage({ text: 'Session terminated successfully.', type: 'success' });
  };

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      if (auditCategory !== 'All' && entry.category !== auditCategory) return false;
      if (!q) return true;
      return (
        entry.action.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q) ||
        entry.actor.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        (entry.reference || '').toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditCategory, auditSearch]);

  const displayedAuditLogs = showAllAudit
    ? filteredAuditLogs
    : filteredAuditLogs.slice(0, 20);

  const handleExportAuditCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Category', 'Action', 'Details', 'Reference', 'Status'];
    const rows = filteredAuditLogs.map((entry) => [
      entry.timestamp,
      entry.actor,
      entry.category,
      entry.action,
      entry.details,
      entry.reference || '',
      entry.status,
    ]);
    const csv = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map((r) => r.map(sanitizeCsvCell).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `island_audit_log_${formatLocalDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!settings) return null;

  const loginHistory = settings.loginHistory || [];
  const displayedHistory = showFullHistory ? loginHistory : loginHistory.slice(0, 3);
  const timeoutEnabled = Number(settings.sessionTimeout ?? 30) > 0;
  const securityScore =
    40 +
    (settings.twoFactorEnabled ? 25 : 0) +
    (settings.loginAlerts ? 15 : 0) +
    (timeoutEnabled ? 20 : 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center text-brand-600">
              <Shield size={24} />
            </div>
            <h1 className="text-4xl font-black text-jamaica-black tracking-tighter uppercase">Security Settings</h1>
          </div>
          <p className="text-slate-500 font-medium">Manage your account security, sessions, and activity audit log.</p>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'security'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Shield size={14} />
            Security Controls
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'audit'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Activity size={14} />
            Audit Log ({auditLogs.length})
          </button>
        </div>
      </header>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-2xl flex items-center gap-3 border",
            message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
          )}
        >
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-bold">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto text-current opacity-50 hover:opacity-100">
            <XCircle size={16} />
          </button>
        </motion.div>
      )}

      {activeTab === 'audit' ? (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Activity Audit Log</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chronological trail of logins, created transactions, ledger adjustments, reconciliations, and security updates.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportAuditCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap self-start lg:self-auto"
            >
              <Download size={14} />
              Export Audit CSV
            </button>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search action, details, actor, or reference..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/60 rounded-xl">
              {(
                [
                  { id: 'All', label: 'All' },
                  { id: 'Auth', label: 'Logins' },
                  { id: 'Transaction', label: 'Transactions' },
                  { id: 'Ledger', label: 'Ledger' },
                  { id: 'Reconciliation', label: 'Reconciliation' },
                  { id: 'Team', label: 'Team' },
                  { id: 'Security', label: 'Security' },
                ] as { id: AuditCategoryFilter; label: string }[]
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setAuditCategory(cat.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                    auditCategory === cat.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {displayedAuditLogs.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-2">
              <History size={28} className="mx-auto text-slate-400" />
              <p className="text-sm font-bold text-slate-900">No matching audit events</p>
              <p className="text-xs text-slate-500">
                Try clearing your search or selecting a different activity category.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-6 whitespace-nowrap">Timestamp</th>
                    <th className="py-3 px-4 whitespace-nowrap">Category</th>
                    <th className="py-3 px-4">Activity & Details</th>
                    <th className="py-3 px-4 whitespace-nowrap">Actor</th>
                    <th className="py-3 px-6 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {displayedAuditLogs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-6 font-mono text-xs tabular-nums whitespace-nowrap text-slate-600">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {entry.category}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{entry.action}</p>
                        <p className="text-xs text-slate-500">
                          {entry.details}
                          {entry.reference ? ` · Ref: ${entry.reference}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700 whitespace-nowrap max-w-[180px] truncate">
                        {entry.actor}
                      </td>
                      <td className="py-3 px-6 text-xs font-semibold whitespace-nowrap">
                        {entry.status === 'Success' && (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 size={13} />
                            Success
                          </span>
                        )}
                        {entry.status === 'Warning' && (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <AlertTriangle size={13} />
                            Warning
                          </span>
                        )}
                        {entry.status === 'Info' && (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Info size={13} />
                            Info
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredAuditLogs.length > 20 && (
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <span>
                Showing {displayedAuditLogs.length} of {filteredAuditLogs.length} events
              </span>
              <button
                type="button"
                onClick={() => setShowAllAudit((prev) => !prev)}
                className="font-bold text-brand-600 hover:text-brand-700 cursor-pointer"
              >
                {showAllAudit ? 'Show Recent 20' : `Show All (${filteredAuditLogs.length})`}
              </button>
            </div>
          )}
        </section>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {/* Password Section */}
          <section className="glass-panel p-8 rounded-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="font-black text-jamaica-black uppercase tracking-tight">Password</h3>
                  <p className="text-xs text-slate-500">Last changed {new Date(settings.lastPasswordChange).toLocaleDateString()}</p>
                </div>
              </div>
              {!isChangingPassword && (
                <button 
                  onClick={() => setIsChangingPassword(true)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Change Password
                </button>
              )}
            </div>

            {isChangingPassword && (
              <form onSubmit={handlePasswordChange} className="space-y-4 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Password</label>
                    <input 
                      type="password" 
                      required
                      value={passwordData.current}
                      onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                  <div className="hidden sm:block" />
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                    <input 
                      type="password" 
                      required
                      value={passwordData.new}
                      onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                    <input 
                      type="password" 
                      required
                      value={passwordData.confirm}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit"
                    className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                  >
                    Update Password
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsChangingPassword(false)}
                    className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Two-Factor Authentication */}
          <section className="glass-panel p-8 rounded-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="font-black text-jamaica-black uppercase tracking-tight">Two-Factor Authentication</h3>
                  <p className="text-xs text-slate-500">Add an extra layer of security to your account</p>
                </div>
              </div>
              <button 
                onClick={handleToggle2FA}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                  settings.twoFactorEnabled ? "bg-brand-600" : "bg-slate-200"
                )}
              >
                <span className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  settings.twoFactorEnabled ? "translate-x-6" : "translate-x-1"
                )} />
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex gap-3">
                <div className="mt-1 text-brand-600">
                  <Lock size={16} />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  When enabled, you'll be asked for a security code in addition to your password when you log in on a new device.
                </p>
              </div>
            </div>
          </section>

          {/* Active Sessions */}
          <section className="glass-panel p-8 rounded-3xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                <Monitor size={20} />
              </div>
              <div>
                <h3 className="font-black text-jamaica-black uppercase tracking-tight">Active Sessions</h3>
                <p className="text-xs text-slate-500">Devices currently logged into your account</p>
              </div>
            </div>

            <div className="space-y-4">
              {settings.activeSessions.map((session: any) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-slate-400">
                      {session.device.includes('iPhone') ? <Smartphone size={20} /> : <Monitor size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{session.device}</span>
                        {session.current && (
                          <span className="text-xs font-semibold text-emerald-700">
                            · Current Session
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{session.location} · {new Date(session.lastActive).toLocaleString()}</p>
                    </div>
                  </div>
                  {!session.current && (
                    <button 
                      onClick={() => handleTerminateSession(session.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="Terminate Session"
                    >
                      <LogOut size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* Security Alerts & Session Policy */}
          <section className="glass-panel p-6 rounded-3xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                <Bell size={18} />
              </div>
              <h3 className="font-black text-jamaica-black uppercase tracking-tight text-sm">Alerts &amp; Session Lock</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Login Notifications</span>
                <button 
                  onClick={handleToggleAlerts}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer",
                    settings.loginAlerts ? "bg-brand-600" : "bg-slate-200"
                  )}
                >
                  <span className={cn(
                    "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                    settings.loginAlerts ? "translate-x-5" : "translate-x-1"
                  )} />
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Receive an alert whenever a new sign-in is detected on your account.
              </p>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label
                  htmlFor="session-timeout-select"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700"
                >
                  <Clock size={14} className="text-brand-600" />
                  Inactivity Auto-Lock
                </label>
                <select
                  id="session-timeout-select"
                  disabled={!canManageSecurity}
                  value={Number(settings.sessionTimeout ?? 30)}
                  onChange={(e) => handleSessionTimeoutChange(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value={15}>Lock after 15 minutes</option>
                  <option value={30}>Lock after 30 minutes (Recommended)</option>
                  <option value={60}>Lock after 60 minutes</option>
                  <option value={0}>Never auto-lock</option>
                </select>
                {!canManageSecurity && (
                  <p className="text-[11px] text-amber-700 font-medium pt-1">
                    Workspace security policies are managed by your Owner.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Login History */}
          <section className="glass-panel p-6 rounded-3xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                <History size={18} />
              </div>
              <h3 className="font-black text-jamaica-black uppercase tracking-tight text-sm">Login History</h3>
            </div>

            <div className="space-y-4">
              {displayedHistory.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{log.device}</span>
                      <span className={cn(
                        "text-xs font-bold",
                        log.status === 'Success' ? "text-emerald-700" : "text-rose-700"
                      )}>
                        · {log.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">{new Date(log.date).toLocaleString()}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{log.ip}</span>
                </div>
              ))}
            </div>
            
            {loginHistory.length > 3 && (
              <button
                type="button"
                onClick={() => setShowFullHistory((prev) => !prev)}
                className="w-full py-2 text-[10px] font-black text-brand-600 uppercase tracking-widest hover:text-brand-700 transition-all flex items-center justify-center gap-1"
              >
                {showFullHistory ? 'Show Recent Only' : `View Full History (${loginHistory.length})`} <ChevronRight size={12} />
              </button>
            )}
          </section>

          {/* Security Score */}
          <section className="bg-jamaica-black p-6 rounded-3xl text-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black uppercase tracking-widest text-xs">Security Score</h3>
              <span className="text-brand-400 font-black text-xl font-mono tabular-nums">{securityScore}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${securityScore}%` }} />
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300 pt-1">
              <li className="flex items-center justify-between">
                <span>User-Isolated Workspace</span>
                <span className="text-emerald-400 font-semibold">Active</span>
              </li>
              <li className="flex items-center justify-between">
                <span>CSV Formula Protection</span>
                <span className="text-emerald-400 font-semibold">Active</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Inactivity Auto-Lock</span>
                <span className={timeoutEnabled ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                  {timeoutEnabled ? `${settings.sessionTimeout ?? 30}m` : 'Off'}
                </span>
              </li>
            </ul>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {securityScore === 100
                ? 'All recommended protections are enabled for your account.'
                : !settings.twoFactorEnabled
                  ? 'Enable Two-Factor Authentication to strengthen your account protection.'
                  : !timeoutEnabled
                    ? 'Enable Inactivity Auto-Lock to protect unattended sessions.'
                    : 'Enable Login Notifications to reach 100%.'}
            </p>
          </section>
        </div>
      </div>
      )}
    </div>
  );
}
