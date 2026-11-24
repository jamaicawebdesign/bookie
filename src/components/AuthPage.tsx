import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  User,
  Building2,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { cn } from '../lib/utils';

type AuthMode = 'login' | 'signup' | 'reset' | 'verify-email' | 'update-password';

interface AuthPageProps {
  onLogin: (user: any) => void;
  initialMode?: AuthMode;
  onPasswordUpdated?: () => void;
  onBackToHome?: () => void;
}

export function AuthPage({ onLogin, initialMode = 'login', onPasswordUpdated, onBackToHome }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [needsConfirmationEmail, setNeedsConfirmationEmail] = useState<string | null>(null);
  const [networkFallbackReady, setNetworkFallbackReady] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    company: '',
  });

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const switchMode = (nextMode: AuthMode) => {
    setFeedback(null);
    setNeedsConfirmationEmail(null);
    setNetworkFallbackReady(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    setMode(nextMode);
  };

  const handleResendConfirmation = async (emailToResend?: string) => {
    const targetEmail = (emailToResend || formData.email).trim();
    if (!targetEmail || !isSupabaseConfigured || !supabase) return;

    setIsResending(true);
    setFeedback(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setFeedback({
        type: 'success',
        message: `Confirmation email resent to ${targetEmail}. Please check your inbox and spam folder.`,
      });
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Unable to resend confirmation email. Please wait a moment and try again.',
      });
    } finally {
      setIsResending(false);
    }
  };

  const runLocalAuthFallback = async () => {
    const email = formData.email.trim();
    if (!email) {
      setFeedback({ type: 'error', message: 'Please enter your email address first.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);
    setNetworkFallbackReady(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const users = dataService.getUsers();

      if (mode === 'reset') {
        setFeedback({
          type: 'success',
          message: 'Local mode active: you can sign in directly or create a new local workspace account.',
        });
        return;
      }

      if (mode === 'signup') {
        if (!formData.name.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const existingIndex = users.findIndex((u: any) => u.email.toLowerCase() === email.toLowerCase());
        const localUser = {
          id: existingIndex >= 0 ? users[existingIndex].id : Math.random().toString(36).slice(2, 11),
          name: formData.name.trim(),
          company: formData.company.trim() || 'Island Bookkeeping',
          role: 'Business Owner',
          email,
          password: formData.password,
          authMode: 'local',
        };

        if (existingIndex >= 0) {
          users[existingIndex] = localUser;
        } else {
          users.push(localUser);
        }
        dataService.saveUsers(users);
        dataService.saveUser(localUser);
        onLogin(localUser);
        return;
      }

      // Local login: match existing user or provision a local session for testing if none exists
      let user = users.find(
        (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === formData.password
      );

      if (!user) {
        const emailConflict = users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
        if (emailConflict) {
          throw new Error('Invalid email or password for this local account.');
        }
        user = {
          id: Math.random().toString(36).slice(2, 11),
          name: email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          company: 'Island Bookkeeping',
          role: 'Business Owner',
          email,
          password: formData.password,
          authMode: 'local',
        };
        users.push(user);
        dataService.saveUsers(users);
      }

      dataService.saveUser(user);
      onLogin(user);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Unable to sign in locally.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback(null);
    setNeedsConfirmationEmail(null);
    setNetworkFallbackReady(false);

    const email = formData.email.trim();

    try {
      if (isSupabaseConfigured && supabase) {
        if (mode === 'update-password') {
          if (formData.password.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
          }
          if (formData.password !== formData.confirmPassword) {
            throw new Error('Passwords do not match.');
          }
          const { data, error } = await supabase.auth.updateUser({
            password: formData.password,
          });
          if (error) throw error;

          if (data.user) {
            const profile = await dataService.syncFromSupabase(data.user.id, data.user);
            onPasswordUpdated?.();
            onLogin(profile);
          } else {
            setFeedback({
              type: 'success',
              message: 'Your password has been updated. You can now sign in.',
            });
            onPasswordUpdated?.();
            switchMode('login');
          }
          return;
        }

        if (mode === 'reset') {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
          });
          if (error) throw error;
          setFeedback({
            type: 'success',
            message: `Password reset link sent to ${email}. Check your inbox to continue.`,
          });
          return;
        }

        if (mode === 'signup') {
          if (!formData.name.trim()) {
            throw new Error('Please enter your full name.');
          }
          if (formData.password.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
          }
          if (formData.password !== formData.confirmPassword) {
            throw new Error('Passwords do not match.');
          }

          const { data, error } = await supabase.auth.signUp({
            email,
            password: formData.password,
            options: {
              emailRedirectTo: window.location.origin,
              data: {
                name: formData.name.trim(),
                full_name: formData.name.trim(),
                company: formData.company.trim() || 'Island Bookkeeping',
              },
            },
          });
          if (error) throw error;

          // Supabase returns empty identities array if account already exists and email confirmation is enabled
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            throw new Error('An account with this email already exists. Try signing in or resetting your password.');
          }

          if (data.session && data.user) {
            const profile = await dataService.syncFromSupabase(data.user.id, data.user);
            onLogin(profile);
          } else {
            setFormData((prev) => ({ ...prev, email, password: '', confirmPassword: '' }));
            setMode('verify-email');
          }
          return;
        }

        // Login with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: formData.password,
        });
        if (error) {
          if (error.message.toLowerCase().includes('email not confirmed')) {
            setNeedsConfirmationEmail(email);
            throw new Error('Your email address has not been confirmed yet. Check your inbox or resend the verification email below.');
          }
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            throw new Error('Invalid email or password. Please double-check your credentials or reset your password.');
          }
          throw error;
        }

        if (data.user) {
          const profile = await dataService.syncFromSupabase(data.user.id, data.user);
          onLogin(profile);
        }
        return;
      }

      // Local fallback when Supabase env vars are not configured
      await new Promise((resolve) => setTimeout(resolve, 350));

      if (mode === 'reset') {
        setFeedback({
          type: 'success',
          message: 'Password reset instructions sent if this account exists.',
        });
        return;
      }

      if (mode === 'update-password') {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        onPasswordUpdated?.();
        switchMode('login');
        return;
      }

      const users = dataService.getUsers();

      if (mode === 'signup') {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        const userExists = users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
        if (userExists) {
          throw new Error('An account with this email already exists.');
        }

        const newUser = {
          id: Math.random().toString(36).substr(2, 9),
          name: formData.name.trim(),
          company: formData.company.trim() || 'Island Bookkeeping',
          role: 'Business Owner',
          email,
          password: formData.password,
        };
        users.push(newUser);
        dataService.saveUsers(users);
        dataService.saveUser(newUser);
        onLogin(newUser);
      } else {
        const user = users.find(
          (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === formData.password
        );
        if (!user) {
          throw new Error('Invalid email or password.');
        }
        dataService.saveUser(user);
        onLogin(user);
      }
    } catch (error: any) {
      const rawMessage = String(error?.message || '');
      const isFetchFailure =
        error?.name === 'AuthRetryableFetchError' ||
        /failed to fetch|networkerror|load failed|err_name_not_resolved/i.test(rawMessage);
      const isInvalidApiKey = /invalid api key/i.test(rawMessage);

      if (isFetchFailure) {
        setNetworkFallbackReady(true);
        setFeedback({
          type: 'error',
          message:
            'Could not reach the Supabase authentication server. Please verify that your Supabase project is active and VITE_SUPABASE_URL in .env is correct, or continue in Local Workspace Mode below.',
        });
      } else if (isInvalidApiKey) {
        setNetworkFallbackReady(true);
        setFeedback({
          type: 'error',
          message:
            'The Supabase API key in .env does not match this project URL (vttbgudpbjvvsswuoetx). Please provide the matching Publishable or Anon key from your Supabase project API settings, or continue in Local Workspace Mode below.',
        });
      } else {
        setFeedback({
          type: 'error',
          message: rawMessage || 'Authentication failed. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: BarChart3, title: 'Advanced Analytics', desc: 'Real-time data processing and visualization.' },
    { icon: Zap, title: 'Smart Insights', desc: 'Automated trend tracking and financial forecasting.' },
    { icon: ShieldCheck, title: 'Enterprise Security', desc: 'Cloud-synced storage with row-level access controls.' },
  ];

  const getHeading = () => {
    switch (mode) {
      case 'signup':
        return 'CREATE ACCOUNT';
      case 'reset':
        return 'RESET PASSWORD';
      case 'verify-email':
        return 'CHECK YOUR EMAIL';
      case 'update-password':
        return 'NEW PASSWORD';
      default:
        return 'WELCOME BACK';
    }
  };

  const getSubheading = () => {
    switch (mode) {
      case 'signup':
        return 'Set up your Island Bookkeeping workspace';
      case 'reset':
        return 'Enter your email to receive a password reset link';
      case 'verify-email':
        return `We sent a confirmation link to ${formData.email}`;
      case 'update-password':
        return 'Choose a new password for your account';
      default:
        return 'Enter your credentials to access your dashboard';
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Left Side: Branding & Features (Desktop Only) */}
      <div className="hidden lg:flex lg:w-[46%] bg-black relative overflow-hidden p-14 flex-col justify-between">
        <div className="absolute top-0 right-0 w-full h-full opacity-25 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-brand-500 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent-500 blur-[100px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 jamaica-gradient rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-brand-500/20">
              I
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white tracking-tighter leading-none">Island</span>
              <span className="text-xs font-bold text-accent-500 uppercase tracking-[0.3em]">Bookkeeping</span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="max-w-md"
          >
            <h1 className="text-5xl xl:text-6xl font-black text-white leading-[0.95] mb-6 tracking-tighter">
              FINANCIAL <span className="text-brand-400 italic">CLARITY</span> FOR THE <span className="text-accent-500">ISLANDS.</span>
            </h1>
            <p className="text-white/90 text-base xl:text-lg mb-10 font-medium leading-relaxed">
              Double-entry ledgers, G.C.T. invoicing, and audit-ready financial statements built for Caribbean and remote enterprises.
            </p>

            <div className="space-y-4">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08 }}
                  className="flex gap-4 items-center p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm"
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-500/25">
                    <f.icon size={22} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">{f.title}</h3>
                    <p className="text-white/85 text-xs mt-0.5">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-white/80 text-xs font-bold uppercase tracking-widest">
          <span>© 2026 Island Bookkeeping Inc.</span>
          <a href="#" className="hover:text-accent-500 transition-colors">Privacy</a>
          <a href="#" className="hover:text-accent-500 transition-colors">Terms</a>
        </div>
      </div>

      {/* Right Side: High-Contrast Framed Auth Form */}
      <div className="w-full lg:w-[54%] flex flex-col items-center justify-center p-5 sm:p-10 relative">
        {onBackToHome && mode !== 'update-password' && (
          <div className="w-full max-w-lg mb-4 flex justify-start">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-black hover:bg-black hover:text-white transition-colors shadow-sm cursor-pointer"
            >
              <ArrowLeft size={15} />
              Back to overview
            </button>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white border-2 border-slate-300 rounded-3xl p-7 sm:p-10 shadow-2xl shadow-slate-900/10"
        >
          <div className="text-center mb-7">
            <div className="lg:hidden flex justify-center mb-5">
              <div className="w-12 h-12 jamaica-gradient rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-brand-500/20">
                I
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-black mb-2 tracking-tight">
              {getHeading()}
            </h2>
            <p className="text-black/80 font-medium text-sm">
              {getSubheading()}
            </p>
          </div>

          {(mode === 'login' || mode === 'signup') && (
            <div className="grid grid-cols-2 p-1.5 bg-black rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={cn(
                  'py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer',
                  mode === 'login'
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'text-white/85 hover:text-white'
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={cn(
                  'py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer',
                  mode === 'signup'
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'text-white/85 hover:text-white'
                )}
              >
                Create Account
              </button>
            </div>
          )}

          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={cn(
                  'mb-6 p-4 rounded-2xl text-sm font-semibold border-2 space-y-3',
                  feedback.type === 'error'
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                )}
              >
                <div className="flex items-start gap-3">
                  {feedback.type === 'error' ? (
                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                  ) : (
                    <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
                  )}
                  <span>{feedback.message}</span>
                </div>
                {needsConfirmationEmail && (
                  <button
                    type="button"
                    disabled={isResending}
                    onClick={() => handleResendConfirmation(needsConfirmationEmail)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-rose-300 rounded-xl text-xs font-bold text-rose-800 hover:bg-rose-100/60 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={14} className={isResending ? 'animate-spin' : ''} />
                    {isResending ? 'Resending...' : 'Resend confirmation email'}
                  </button>
                )}
                {networkFallbackReady && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={runLocalAuthFallback}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-brand-600 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Continue in Local Workspace Mode
                    <ArrowRight size={14} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {mode === 'verify-email' ? (
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 text-center space-y-6">
              <div className="w-16 h-16 mx-auto bg-brand-100 text-brand-700 rounded-2xl flex items-center justify-center">
                <Mail size={32} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-black leading-relaxed">
                  Click the confirmation link in your email to activate your account, then return here to sign in.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={isResending}
                  onClick={() => handleResendConfirmation()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-slate-300 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={15} className={isResending ? 'animate-spin' : ''} />
                  {isResending ? 'Sending...' : 'Resend Confirmation Email'}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
                >
                  <ArrowLeft size={15} />
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-black uppercase tracking-wider ml-0.5">
                        Full Name
                      </label>
                      <div className="relative group">
                        <User
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-brand-600 transition-colors"
                          size={18}
                        />
                        <input
                          type="text"
                          required
                          autoComplete="name"
                          placeholder="Kareem Campbell"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-brand-600 rounded-xl text-sm font-semibold text-black placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-black uppercase tracking-wider ml-0.5">
                        Company Name <span className="text-slate-700 font-semibold normal-case">(Optional)</span>
                      </label>
                      <div className="relative group">
                        <Building2
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-brand-600 transition-colors"
                          size={18}
                        />
                        <input
                          type="text"
                          autoComplete="organization"
                          placeholder="Blue Mountain Logistics Ltd."
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-brand-600 rounded-xl text-sm font-semibold text-black placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 transition-all"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode !== 'update-password' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider ml-0.5">
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-brand-600 transition-colors"
                      size={18}
                    />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="name@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-brand-600 rounded-xl text-sm font-semibold text-black placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 transition-all"
                    />
                  </div>
                </div>
              )}

              {mode !== 'reset' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-black uppercase tracking-wider ml-0.5">
                      {mode === 'update-password' ? 'New Password' : 'Password'}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-xs font-bold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-brand-600 transition-colors"
                      size={18}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-11 pr-12 py-3 bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-brand-600 rounded-xl text-sm font-semibold text-black placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-700 hover:text-black transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {(mode === 'signup' || mode === 'update-password') && (
                    <p className="text-xs font-medium text-slate-700 ml-0.5">Must be at least 6 characters</p>
                  )}
                </div>
              )}

              {(mode === 'signup' || mode === 'update-password') && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider ml-0.5">
                    Confirm Password
                  </label>
                  <div className="relative group">
                    <Lock
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-brand-600 transition-colors"
                      size={18}
                    />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full pl-11 pr-12 py-3 bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-brand-600 rounded-xl text-sm font-semibold text-black placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-700 hover:text-black transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-4 mt-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === 'login'
                      ? 'Sign In to Workspace'
                      : mode === 'signup'
                        ? 'Create Account'
                        : mode === 'update-password'
                          ? 'Update Password'
                          : 'Send Reset Link'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {mode !== 'verify-email' && mode !== 'update-password' && (
            <p className="text-center mt-6 pt-5 border-t border-slate-200 text-sm font-medium text-black">
              {mode === 'login'
                ? "Don't have an account?"
                : mode === 'signup'
                  ? 'Already have an account?'
                  : 'Remembered your password?'}{' '}
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="font-bold text-brand-700 hover:text-brand-800 hover:underline transition-colors cursor-pointer"
              >
                {mode === 'login' ? 'Create one now' : 'Sign in'}
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
