import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FolderKanban,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import type { CompanySettings, CuttingProject } from './types/cutmaster';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  deleteProjectFromCloud,
  fetchCompanySettings,
  publishShareSnapshot,
  saveCompanySettings,
  saveProjectToCloud,
  subscribeUserProjects,
} from './lib/firestoreService';
import {
  clearPendingSyncOp,
  getPendingSyncOps,
  loadProjectsFromLocalCache,
  loadSettingsFromLocalCache,
  queueOfflineSyncOp,
  saveProjectsToLocalCache,
  saveSettingsToLocalCache,
} from './lib/offlineCache';
import { createSampleCabinetParts, DEFAULT_SHEET_CONFIG } from './lib/presets';
import { optimizeMdfCutting } from './lib/optimizer';
import { AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import { ProjectStudioView } from './components/ProjectStudioView';
import { SettingsView } from './components/SettingsView';
import { SharedProjectView } from './components/SharedProjectView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

type ActiveTab = 'dashboard' | 'studio' | 'settings';

function createDefaultSettings(ownerId: string): CompanySettings {
  return {
    ownerId,
    companyName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    currency: '$',
    defaultSheetLength: DEFAULT_SHEET_CONFIG.length,
    defaultSheetWidth: DEFAULT_SHEET_CONFIG.width,
    defaultThickness: DEFAULT_SHEET_CONFIG.thickness,
    defaultCostPerSheet: DEFAULT_SHEET_CONFIG.costPerSheet,
    defaultMaterialType: DEFAULT_SHEET_CONFIG.materialType,
    defaultKerf: DEFAULT_SHEET_CONFIG.kerf,
    theme: 'light',
    updatedAt: new Date().toISOString(),
  };
}

function createNewProjectObject(
  ownerId: string,
  settings: CompanySettings,
  withSampleParts = false,
  isLocalOnly = false
): CuttingProject {
  const sheetConfig = {
    length: settings.defaultSheetLength || 2440,
    width: settings.defaultSheetWidth || 1220,
    thickness: settings.defaultThickness || 18,
    costPerSheet: settings.defaultCostPerSheet ?? 48,
    materialType: settings.defaultMaterialType || 'Standard Raw MDF',
    kerf: settings.defaultKerf ?? 3.2,
    trimMargin: 5,
    allowRotation: true,
  };
  const parts = withSampleParts ? createSampleCabinetParts() : [];
  const res = optimizeMdfCutting(parts, sheetConfig);
  const now = new Date().toISOString();

  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ownerId,
    name: withSampleParts ? 'Wardrobe Cabinet Cut Plan' : 'New MDF Project',
    customerName: '',
    notes: '',
    status: res.totalSheets > 0 ? 'optimized' : 'draft',
    sheetConfig,
    parts,
    summary: {
      totalSheets: res.totalSheets,
      efficiencyPct: res.efficiencyPct,
      wastePct: res.wastePct,
      totalMaterialCost: res.totalMaterialCost,
      usedAreaSqM: res.usedAreaSqM,
      wasteAreaSqM: res.wasteAreaSqM,
      totalPartsPlaced: res.totalPartsPlaced,
    },
    createdAt: now,
    updatedAt: now,
    isLocalOnly,
  };
}

const WorkspaceShell: React.FC = () => {
  const { user, authReady, localMode, exitLocalMode, logout } = useAuth();
  const { theme, setTheme, toggleTheme } = useTheme();
  const isOnline = useOnlineStatus();

  const [shareParam, setShareParam] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('share');
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [projects, setProjects] = useState<CuttingProject[]>(() =>
    loadProjectsFromLocalCache()
  );
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [settings, setSettings] = useState<CompanySettings>(() => {
    const cached = loadSettingsFromLocalCache();
    return cached || createDefaultSettings('local_user');
  });

  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline' | 'idle'>('idle');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  const isCloudVerified = Boolean(user && user.emailVerified);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  }, []);

  // Load company settings & subscribe to projects for verified cloud users
  useEffect(() => {
    if (!user) return;

    if (user.emailVerified) {
      fetchCompanySettings(user.uid)
        .then((loaded) => {
          if (loaded) {
            setSettings(loaded);
            saveSettingsToLocalCache(loaded);
            if (loaded.theme) setTheme(loaded.theme);
          } else {
            setSettings((prev) => ({ ...prev, ownerId: user.uid }));
          }
        })
        .catch(() => {
          // Offline or first load
        });
    }

    setLoadingProjects(true);
    const unsub = subscribeUserProjects(
      user.uid,
      (cloudProjects) => {
        setProjects(cloudProjects);
        saveProjectsToLocalCache(cloudProjects);
        setLoadingProjects(false);
        if (cloudProjects.length > 0 && !activeProjectId) {
          setActiveProjectId(cloudProjects[0].id);
        }
      },
      () => {
        setLoadingProjects(false);
      }
    );

    return () => unsub();
  }, [user, setTheme, activeProjectId]);

  // Ensure local mode has at least one starter project
  useEffect(() => {
    if (localMode && !user && projects.length === 0) {
      const starter = createNewProjectObject('local_user', settings, true, true);
      setProjects([starter]);
      saveProjectsToLocalCache([starter]);
      setActiveProjectId(starter.id);
      setActiveTab('studio');
    }
  }, [localMode, user, projects.length, settings]);

  // Auto-sync queued offline operations when coming back online
  useEffect(() => {
    if (!isOnline || !isCloudVerified || !user) return;
    const ops = getPendingSyncOps();
    if (ops.length === 0) return;

    (async () => {
      for (const op of ops) {
        try {
          if (op.type === 'upsert_project' && op.project) {
            await saveProjectToCloud({ ...op.project, ownerId: user.uid, isLocalOnly: false });
          } else if (op.type === 'delete_project') {
            await deleteProjectFromCloud(op.projectId);
          }
          clearPendingSyncOp(op.projectId);
        } catch {
          // Retry on next reconnect
        }
      }
      showToast('Offline changes synced to cloud.');
    })();
  }, [isOnline, isCloudVerified, user, showToast]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0] || null,
    [projects, activeProjectId]
  );

  const persistProject = useCallback(
    async (proj: CuttingProject) => {
      if (!isOnline || !isCloudVerified || !user) {
        setSaveState('offline');
        if (user) {
          queueOfflineSyncOp({
            type: 'upsert_project',
            projectId: proj.id,
            project: proj,
            queuedAt: new Date().toISOString(),
          });
        }
        return;
      }

      setSaveState('saving');
      try {
        await saveProjectToCloud({ ...proj, ownerId: user.uid, isLocalOnly: false });
        clearPendingSyncOp(proj.id);
        setSaveState('saved');
      } catch {
        setSaveState('offline');
        queueOfflineSyncOp({
          type: 'upsert_project',
          projectId: proj.id,
          project: proj,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [isOnline, isCloudVerified, user]
  );

  const handleUpdateProject = useCallback(
    (updated: CuttingProject) => {
      setProjects((prev) => {
        const next = prev.map((p) => (p.id === updated.id ? updated : p));
        saveProjectsToLocalCache(next);
        return next;
      });

      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      setSaveState(isOnline && isCloudVerified ? 'saving' : 'offline');
      autoSaveTimerRef.current = window.setTimeout(() => {
        void persistProject(updated);
      }, 900);
    },
    [isOnline, isCloudVerified, persistProject]
  );

  const handleCreateProject = () => {
    const ownerId = user?.uid || 'local_user';
    const created = createNewProjectObject(ownerId, settings, projects.length === 0, !isCloudVerified);
    setProjects((prev) => {
      const next = [created, ...prev];
      saveProjectsToLocalCache(next);
      return next;
    });
    setActiveProjectId(created.id);
    setActiveTab('studio');
    setMobileMenuOpen(false);
    void persistProject(created);
  };

  const handleOpenProject = (proj: CuttingProject) => {
    setActiveProjectId(proj.id);
    setActiveTab('studio');
    setMobileMenuOpen(false);
  };

  const handleDuplicateProject = (proj: CuttingProject) => {
    const ownerId = user?.uid || 'local_user';
    const now = new Date().toISOString();
    const dup: CuttingProject = {
      ...proj,
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ownerId,
      name: `${proj.name} (Copy)`,
      status: proj.summary.totalSheets > 0 ? 'optimized' : 'draft',
      shareId: undefined,
      createdAt: now,
      updatedAt: now,
      isLocalOnly: !isCloudVerified,
    };
    setProjects((prev) => {
      const next = [dup, ...prev];
      saveProjectsToLocalCache(next);
      return next;
    });
    setActiveProjectId(dup.id);
    setActiveTab('studio');
    void persistProject(dup);
    showToast(`Duplicated "${proj.name}"`);
  };

  const handleDeleteProject = async (projectId: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== projectId);
      saveProjectsToLocalCache(next);
      return next;
    });
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
    if (isCloudVerified && isOnline && user) {
      try {
        await deleteProjectFromCloud(projectId);
      } catch {
        queueOfflineSyncOp({
          type: 'delete_project',
          projectId,
          queuedAt: new Date().toISOString(),
        });
      }
    }
    showToast('Project deleted');
  };

  const handleShareProject = async (proj: CuttingProject): Promise<string | null> => {
    if (!isCloudVerified || !user) {
      showToast('Sign in with a verified account to generate a cloud share link.');
      return null;
    }
    if (!isOnline) {
      showToast('Reconnect to the internet to publish a share link.');
      return null;
    }
    try {
      await saveProjectToCloud({ ...proj, ownerId: user.uid, isLocalOnly: false });
      const shareId = await publishShareSnapshot(
        { ...proj, ownerId: user.uid },
        settings.companyName
      );
      setProjects((prev) =>
        prev.map((p) => (p.id === proj.id ? { ...p, shareId } : p))
      );
      return shareId;
    } catch {
      showToast('Failed to publish shareable link.');
      return null;
    }
  };

  const handleShareFromDashboard = async (proj: CuttingProject) => {
    const shareId = await handleShareProject(proj);
    if (shareId) {
      const url = `${window.location.origin}/?share=${encodeURIComponent(shareId)}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast('Shareable cutting plan link copied to clipboard.');
      } catch {
        showToast(`Share link ready: ?share=${shareId}`);
      }
    }
  };

  const handleSaveSettings = async (nextSettings: CompanySettings) => {
    const updated: CompanySettings = {
      ...nextSettings,
      ownerId: user?.uid || 'local_user',
      updatedAt: new Date().toISOString(),
    };
    setSettings(updated);
    saveSettingsToLocalCache(updated);
    if (isCloudVerified && isOnline && user) {
      await saveCompanySettings(updated);
    }
  };

  // Shared Link Route View
  if (shareParam) {
    return (
      <SharedProjectView
        shareId={shareParam}
        onExitShare={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('share');
          window.history.replaceState({}, '', url.toString());
          setShareParam(null);
        }}
      />
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#111315]">
        <div className="text-sm font-medium text-zinc-500">Loading CutMaster workspace...</div>
      </div>
    );
  }

  if (!user && !localMode) {
    return <AuthView />;
  }

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'studio', label: 'Cut Studio', icon: FolderKanban },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const breadcrumbLabel =
    activeTab === 'dashboard'
      ? 'Projects Overview'
      : activeTab === 'studio'
        ? activeProject?.name || 'Cut Studio'
        : 'Company & Defaults';

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-[#111315] text-zinc-900 dark:text-zinc-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* Charcoal Industrial Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#181B1F] text-zinc-200 border-r border-zinc-800 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-6">
          {/* Brand */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-base font-bold text-white truncate">
                CutMaster
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Nav */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-orange-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Project Switcher */}
          {projects.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-zinc-800">
              <div className="px-2 flex items-center justify-between text-xs font-semibold text-zinc-400">
                <span>Recent Plans</span>
                <button
                  type="button"
                  onClick={handleCreateProject}
                  title="New Project"
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-0.5 max-h-52 overflow-y-auto">
                {projects.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleOpenProject(p)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs truncate transition-colors cursor-pointer ${
                      activeTab === 'studio' && activeProject?.id === p.id
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer: PWA Install, Theme, User */}
        <div className="p-4 border-t border-zinc-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <PWAInstallButton />
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer ml-auto"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {user?.displayName || 'Local Workshop'}
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                {user?.email || 'Offline sandbox mode'}
              </div>
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => void logout()}
                title="Sign Out"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={exitLocalMode}
                className="rounded-md bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-orange-500 shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract (Breadcrumb Left · Primary CTA Right) */}
        <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14171A] px-4 sm:px-6 flex items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-zinc-400 dark:text-zinc-500 hidden sm:inline whitespace-nowrap">
                CutMaster
              </span>
              <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {breadcrumbLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCreateProject}
              className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {user && !user.emailVerified && (
            <div className="mb-5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
              <span>
                Your email is not verified yet. Cloud sync is paused until verification—open Settings to resend or verify.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="font-semibold underline cursor-pointer"
              >
                Go to Verification
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              projects={projects}
              currency={settings.currency || '$'}
              loading={loadingProjects}
              onCreateProject={handleCreateProject}
              onOpenProject={handleOpenProject}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={(id) => void handleDeleteProject(id)}
              onShareProject={(p) => void handleShareFromDashboard(p)}
            />
          )}

          {activeTab === 'studio' && (
            activeProject ? (
              <ProjectStudioView
                project={activeProject}
                settings={settings}
                isCloudUser={isCloudVerified}
                saveState={saveState}
                onUpdateProject={handleUpdateProject}
                onShareProject={handleShareProject}
              />
            ) : (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-12 text-center space-y-4">
                <h2 className="font-display text-lg font-bold">No active project selected</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Create a new MDF cutting project or open an existing plan from your Dashboard.
                </p>
                <button
                  type="button"
                  onClick={handleCreateProject}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Project</span>
                </button>
              </div>
            )
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
            />
          )}
        </main>
      </div>

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-white shadow-xl"
        >
          {toastMsg}
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
