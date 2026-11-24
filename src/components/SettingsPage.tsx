import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Bell,
  Shield,
  DollarSign,
  Smartphone,
  Camera,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { hasPermission, normalizeRole } from '../lib/permissions';
import { dataService } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SettingsSection } from './TopBar';

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function Toggle({ enabled, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
        enabled ? 'bg-brand-600' : 'bg-slate-200'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}

interface SettingsPageProps {
  user: any;
  onUpdateUser: (user: any) => void;
  initialSection?: SettingsSection;
}

export function SettingsPage({ user, onUpdateUser, initialSection = 'profile' }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const canManageBilling = hasPermission(user, 'manage_billing');
  const canManageSecurity = hasPermission(user, 'manage_security');

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
    company: user?.company || '',
    photo: user?.photo || '',
  });

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        role: user.role || '',
        company: user.company || '',
        photo: user.photo || '',
      });
    }
  }, [user]);

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    pushNotifications: false,
    weeklyReports: true,
    securityAlerts: true,
  });

  const [billing, setBilling] = useState({
    taxRate: 15.0,
    currency: 'USD',
    invoicePrefix: 'INV-',
  });

  const [securitySettings, setSecuritySettings] = useState<any>(() => dataService.getSecuritySettings());

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const [showPassword, setShowPassword] = useState(false);

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = () => {
    try {
      const settingsData = dataService.getSettings();
      setBilling({
        taxRate: settingsData.tax_rate != null ? Number(settingsData.tax_rate) : 15.0,
        currency: settingsData.currency || 'USD',
        invoicePrefix: settingsData.invoice_prefix || 'INV-',
      });
      if (settingsData.notifications) {
        setNotifications({
          emailAlerts: Boolean(settingsData.notifications.emailAlerts),
          pushNotifications: Boolean(settingsData.notifications.pushNotifications),
          weeklyReports: Boolean(settingsData.notifications.weeklyReports),
          securityAlerts: Boolean(settingsData.notifications.securityAlerts),
        });
      }
      setSecuritySettings(dataService.getSecuritySettings());
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  useEffect(() => {
    fetchSettings();
    window.addEventListener('island-data-synced', fetchSettings);
    return () => window.removeEventListener('island-data-synced', fetchSettings);
  }, []);

  const handleSaveProfileAndBilling = () => {
    setIsSaving(true);
    try {
      if (canManageBilling) {
        dataService.saveSettings({
          tax_rate: Number(billing.taxRate) || 0,
          currency: billing.currency || 'USD',
          invoice_prefix: billing.invoicePrefix.trim() || 'INV-',
          notifications,
        });
      } else {
        dataService.saveSettings({ notifications });
      }

      // Never allow non-owner self-elevation via profile form
      const { role: _ignoredRole, ...safeProfile } = profile;
      const updatedUser = dataService.saveUser({
        ...safeProfile,
        role: normalizeRole(user?.role),
      });
      onUpdateUser(updatedUser);
      showNotice('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showNotice('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
      showNotice('Image must be smaller than 800 KB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile((prev) => ({ ...prev, photo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleToggleTwoFactor = (enabled: boolean) => {
    if (!canManageSecurity) {
      showNotice('Only workspace Owners can modify 2FA settings', 'error');
      return;
    }
    const updated = { ...securitySettings, twoFactorEnabled: enabled };
    setSecuritySettings(updated);
    dataService.saveSecuritySettings(updated);
    showNotice(`Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleRevokeSession = (sessionId: string) => {
    const updated = {
      ...securitySettings,
      activeSessions: (securitySettings.activeSessions || []).filter((s: any) => s.id !== sessionId),
    };
    setSecuritySettings(updated);
    dataService.saveSecuritySettings(updated);
    showNotice('Session revoked successfully');
  };

  const handleUpdatePassword = async () => {
    if (!passwords.new || passwords.new.length < 6) {
      showNotice('New password must be at least 6 characters', 'error');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      showNotice('New passwords do not match', 'error');
      return;
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) {
        showNotice(error.message || 'Failed to update password', 'error');
        return;
      }
    }

    const updatedSec = { ...securitySettings, lastPasswordChange: new Date().toISOString() };
    setSecuritySettings(updatedSec);
    dataService.saveSecuritySettings(updatedSec);
    setPasswords({ current: '', new: '', confirm: '' });
    showNotice('Password updated successfully');
  };

  const sidebarItems: { id: SettingsSection; label: string; icon: any }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'billing', label: 'Billing & Tax', icon: DollarSign },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const sessions = securitySettings?.activeSessions || [];
  const initials = (profile.name || 'U').trim().substring(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Settings Sidebar */}
        <div className="space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                activeSection === item.id
                  ? 'bg-white text-brand-600 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="md:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            {activeSection === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="glass-panel p-8 rounded-3xl space-y-8"
              >
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-3xl font-bold overflow-hidden border-4 border-white shadow-md">
                      {profile.photo ? (
                        <img src={profile.photo} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        initials
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-slate-100 text-slate-600 hover:text-brand-600 transition-all cursor-pointer">
                      <Camera size={16} />
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Profile Picture</h3>
                    <p className="text-sm text-slate-500">JPG, GIF or PNG. Max size of 800KB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Full Name</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Role</label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={normalizeRole(profile.role)}
                      className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 cursor-not-allowed"
                    />
                    <p className="text-[11px] text-slate-500">
                      Workspace roles are managed by Owners in Team &amp; Access.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Company</label>
                    <input
                      type="text"
                      value={profile.company}
                      onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveProfileAndBilling}
                    className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </motion.div>
            )}

            {activeSection === 'billing' && (
              <motion.div
                key="billing"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="glass-panel p-8 rounded-3xl space-y-8"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Billing Configuration</h3>
                  <p className="text-sm text-slate-500">Set up your default tax rates, currency, and invoice numbering</p>
                </div>

                {!canManageBilling && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">
                    Read-only view: Only workspace Owners can modify tax rates, currency, and invoice numbering.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Default Sales Tax (%)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        disabled={!canManageBilling}
                        value={billing.taxRate}
                        onChange={(e) => setBilling({ ...billing, taxRate: Number(e.target.value) })}
                        className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">This rate will be applied to all new invoices by default.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Currency</label>
                    <select
                      disabled={!canManageBilling}
                      value={billing.currency}
                      onChange={(e) => setBilling({ ...billing, currency: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="JMD">JMD - Jamaican Dollar</option>
                      <option value="TTD">TTD - Trinidad & Tobago Dollar</option>
                      <option value="BBD">BBD - Barbadian Dollar</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Invoice Number Prefix</label>
                    <input
                      type="text"
                      disabled={!canManageBilling}
                      value={billing.invoicePrefix}
                      onChange={(e) => setBilling({ ...billing, invoicePrefix: e.target.value })}
                      placeholder="INV-"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {canManageBilling && (
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSaveProfileAndBilling}
                      className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Billing Settings'}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeSection === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="glass-panel p-8 rounded-3xl space-y-6"
              >
                <div className="space-y-1 mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Notification Preferences</h3>
                  <p className="text-sm text-slate-500">Choose how you want to be notified about platform activity</p>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 'emailAlerts', label: 'Email Notifications', desc: 'Receive daily summaries and critical alerts via email' },
                    { id: 'pushNotifications', label: 'Push Notifications', desc: 'Real-time desktop alerts for system events' },
                    { id: 'weeklyReports', label: 'Weekly Performance Reports', desc: 'Detailed PDF reports sent every Monday morning' },
                    { id: 'securityAlerts', label: 'Security Alerts', desc: 'Immediate notification on login from new devices' },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                      <Toggle
                        enabled={notifications[item.id as keyof typeof notifications]}
                        onChange={(val) => {
                          const updated = { ...notifications, [item.id]: val };
                          setNotifications(updated);
                          dataService.saveSettings({ notifications: updated });
                          showNotice('Notification preferences updated');
                        }}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeSection === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="glass-panel p-8 rounded-3xl space-y-8">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">Security Settings</h3>
                    <p className="text-sm text-slate-500">Secure your account with two-factor authentication and password management</p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-brand-50/50 rounded-2xl border border-brand-100">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                          <Smartphone size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Two-Factor Authentication (2FA)</p>
                          <p className="text-xs text-slate-500 max-w-md mt-1">
                            Add an extra layer of security to your account by requiring more than just a password to log in.
                          </p>
                        </div>
                      </div>
                      <Toggle
                        enabled={Boolean(securitySettings?.twoFactorEnabled)}
                        onChange={handleToggleTwoFactor}
                      />
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-900">Change Password</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-700">Current Password</label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={passwords.current}
                              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-700">New Password</label>
                            <input
                              type="password"
                              value={passwords.new}
                              onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                              placeholder="Minimum 6 characters"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-700">Confirm New Password</label>
                            <input
                              type="password"
                              value={passwords.confirm}
                              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                              placeholder="••••••••"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleUpdatePassword}
                          className="w-fit px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-all"
                        >
                          Update Password
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-8 rounded-3xl space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">Active Sessions</h3>
                    <p className="text-sm text-slate-500">Devices currently logged into your account</p>
                  </div>

                  <div className="space-y-4">
                    {sessions.map((session: any) => (
                      <div key={session.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <Smartphone size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {session.device}
                              {session.current && (
                                <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Current
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              {session.location} • {session.lastActive ? new Date(session.lastActive).toLocaleString() : 'Active'}
                            </p>
                          </div>
                        </div>
                        {!session.current && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(session.id)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-all"
                          >
                            Revoke Access
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              'fixed bottom-8 right-8 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 text-white',
              toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-900'
            )}
          >
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center',
                toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
              )}
            >
              {toast.type === 'error' ? <AlertTriangle size={14} /> : <Check size={14} />}
            </div>
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
