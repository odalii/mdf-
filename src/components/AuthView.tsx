import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Layers, Lock, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import workshopStudioImg from '../assets/images/workshop_cnc_studio_1794766829180.jpg';

type AuthMode = 'login' | 'signup' | 'reset';

function mapAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not enabled in Firebase Console yet. Use Google Sign-In below, or enable Email/Password under Firebase Console → Authentication → Sign-in method.';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password must be at least 6 characters long.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completion.';
  }
  return msg.replace('Firebase: ', '');
}

export const AuthView: React.FC = () => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    enterLocalMode,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
      } else if (mode === 'signup') {
        if (!name.trim()) {
          setError('Please enter your name or workshop title.');
          setBusy(false);
          return;
        }
        await signUpWithEmail(name.trim(), email.trim(), password);
        setInfo('Account created! A verification email has been sent to your inbox.');
      } else {
        await sendPasswordReset(email.trim());
        setInfo('Password reset link sent. Check your inbox and spam folder.');
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-zinc-50 dark:bg-[#111315] text-zinc-900 dark:text-zinc-100">
      {/* Left Industrial Studio Panel */}
      <div className="relative lg:col-span-7 flex flex-col justify-between bg-[#181B1F] text-white overflow-hidden min-h-[280px] lg:min-h-screen">
        {!imgError ? (
          <img
            src={workshopStudioImg}
            alt="Precision CNC panel saw workshop with stacked MDF sheets"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-[#181B1F] to-orange-950/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111315] via-[#111315]/55 to-[#111315]/70" />

        <div className="relative z-10 p-6 sm:p-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center shadow-sm">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            CutMaster MDF Optimizer
          </span>
        </div>

        <div className="relative z-10 p-6 sm:p-10 max-w-2xl space-y-5">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
            Precision 2D MDF nesting built for modern cabinet shops.
          </h1>
          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-xl">
            Minimize board offcuts, calculate exact sheet costs, inspect guillotine saw lines interactively, and export client-ready PDF cut sheets. Completely free with cloud sync across all devices.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/15 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
              <span>Multi-pass 2D Guillotine Packing</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
              <span>Kerf & Edge Banding Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
              <span>100% Free · No Paywalls</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-white dark:bg-[#14171A]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md space-y-6"
        >
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {mode === 'login' && 'Sign in to your workshop'}
              {mode === 'signup' && 'Create your free account'}
              {mode === 'reset' && 'Reset your password'}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {mode === 'login' && 'Access your saved MDF projects, presets, and PDF reports.'}
              {mode === 'signup' && 'Sync projects across desktop, tablet, and shop-floor mobile.'}
              {mode === 'reset' && 'Enter your email address to receive a password reset link.'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setInfo(null); }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-[#22262C] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setInfo(null); }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white dark:bg-[#22262C] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => { setMode('reset'); setError(null); setInfo(null); }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'reset'
                  ? 'bg-white dark:bg-[#22262C] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Reset
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 leading-relaxed">
              {error}
            </div>
          )}

          {info && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
              {info}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleGoogle()}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1E2228] px-4 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-[#252A31] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
              <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
            <span className="shrink-0 px-3 text-xs text-zinc-400">or with email</span>
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name or Workshop
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Apex Cabinetmakers"
                    required
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1B1F24] pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carpenter@workshop.com"
                  required
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1B1F24] pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1B1F24] pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span>
                {mode === 'login' && 'Sign In'}
                {mode === 'signup' && 'Create Free Account'}
                {mode === 'reset' && 'Send Reset Link'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Need offline shop access first?
            </span>
            <button
              type="button"
              onClick={enterLocalMode}
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Local Workspace
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
