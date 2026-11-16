import React, { useRef, useState } from 'react';
import { Building2, Check, Moon, Save, Sun, Upload, User } from 'lucide-react';
import type { CompanySettings } from '../types/cutmaster';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsViewProps {
  settings: CompanySettings;
  onSaveSettings: (next: CompanySettings) => Promise<void>;
}

async function compressLogoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 220;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/png', 0.85);
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
}) => {
  const { user, updateUserDisplayName, resendVerification, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [form, setForm] = useState<CompanySettings>(settings);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressLogoToDataUrl(file);
    if (dataUrl) {
      setForm((prev) => ({ ...prev, logoDataUrl: dataUrl }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedOk(false);
    try {
      if (user && displayName.trim() && displayName.trim() !== user.displayName) {
        await updateUserDisplayName(displayName.trim());
      }
      await onSaveSettings({ ...form, theme });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Company &amp; Workshop Settings
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Configure branding for PDF cut reports, default MDF board sizes, and saw kerf preferences.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Profile & Appearance */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <h2 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
                User Profile &amp; Workspace Theme
              </h2>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-[#111315] border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[#22262C] text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!user}
                placeholder={user ? 'Your name' : 'Local Workshop User'}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Account Email
              </label>
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#111315] px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="truncate">{user?.email || 'Not signed in (Local Mode)'}</span>
                {user && (
                  <span
                    className={`text-xs font-semibold shrink-0 ml-2 ${
                      user.emailVerified
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {user.emailVerified ? 'Verified' : 'Unverified'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {user && !user.emailVerified && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
              <span>
                Verify your email address to enable cloud sync across devices.
                {verifyMsg ? ` (${verifyMsg})` : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await resendVerification();
                    setVerifyMsg('Verification email sent');
                  }}
                  className="rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-500 cursor-pointer"
                >
                  Resend Email
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await refreshUser();
                    setVerifyMsg(ok ? 'Verified!' : 'Not verified yet');
                  }}
                  className="rounded-md border border-amber-500 px-2.5 py-1 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
                >
                  I&apos;ve Verified
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Company Branding */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <h2 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Company Branding for PDF Reports
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-[#111315] flex items-center justify-center overflow-hidden shrink-0">
              {form.logoDataUrl ? (
                <img
                  src={form.logoDataUrl}
                  alt="Company logo"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Building2 className="w-6 h-6 text-zinc-400" />
              )}
            </div>
            <div className="space-y-1.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => void handleLogoUpload(e)}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#22262C] px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Company Logo</span>
                </button>
                {form.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, logoDataUrl: undefined }))}
                    className="text-xs text-red-600 hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                PNG or JPG, automatically scaled for crisp PDF headers.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Company / Workshop Name
              </label>
              <input
                type="text"
                maxLength={120}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Precision Joinery Ltd."
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                maxLength={8}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                placeholder="$"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                maxLength={254}
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                placeholder="orders@joinery.com"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                maxLength={40}
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                placeholder="+1 (555) 234-5678"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Workshop Address
              </label>
              <input
                type="text"
                maxLength={300}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="42 Timber Yard Road, Industrial Park"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>
        </section>

        {/* Default MDF Parameters */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-5 space-y-4">
          <h2 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Default MDF Sheet &amp; Kerf Values (Applied to New Projects)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Length (mm)
              </label>
              <input
                type="number"
                value={form.defaultSheetLength}
                onChange={(e) =>
                  setForm({ ...form, defaultSheetLength: Math.max(100, Number(e.target.value) || 2440) })
                }
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Width (mm)
              </label>
              <input
                type="number"
                value={form.defaultSheetWidth}
                onChange={(e) =>
                  setForm({ ...form, defaultSheetWidth: Math.max(100, Number(e.target.value) || 1220) })
                }
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Thickness (mm)
              </label>
              <input
                type="number"
                value={form.defaultThickness}
                onChange={(e) =>
                  setForm({ ...form, defaultThickness: Math.max(1, Number(e.target.value) || 18) })
                }
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Default Cost
              </label>
              <input
                type="number"
                value={form.defaultCostPerSheet}
                onChange={(e) =>
                  setForm({ ...form, defaultCostPerSheet: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Default Kerf (mm)
              </label>
              <input
                type="number"
                step={0.1}
                value={form.defaultKerf}
                onChange={(e) =>
                  setForm({ ...form, defaultKerf: Math.max(0, Number(e.target.value) || 3.2) })
                }
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Material Type
              </label>
              <input
                type="text"
                value={form.defaultMaterialType}
                onChange={(e) => setForm({ ...form, defaultMaterialType: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          {savedOk && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="w-4 h-4" /> Settings saved
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Workshop Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
