import type { CompanySettings, CuttingProject } from '../types/cutmaster';

const PROJECTS_CACHE_KEY = 'cutmaster_projects_cache_v1';
const SETTINGS_CACHE_KEY = 'cutmaster_settings_cache_v1';
const PENDING_SYNC_KEY = 'cutmaster_pending_sync_v1';

export interface PendingSyncOp {
  type: 'upsert_project' | 'delete_project';
  projectId: string;
  project?: CuttingProject;
  queuedAt: string;
}

export function saveProjectsToLocalCache(projects: CuttingProject[]): void {
  try {
    localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projects));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadProjectsFromLocalCache(): CuttingProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSettingsToLocalCache(settings: CompanySettings): void {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSettingsFromLocalCache(): CompanySettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CompanySettings;
  } catch {
    return null;
  }
}

export function queueOfflineSyncOp(op: PendingSyncOp): void {
  try {
    const existing = getPendingSyncOps().filter((item) => item.projectId !== op.projectId);
    existing.push(op);
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(existing));
  } catch {
    // Ignore storage quota errors
  }
}

export function getPendingSyncOps(): PendingSyncOp[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearPendingSyncOp(projectId: string): void {
  try {
    const remaining = getPendingSyncOps().filter((op) => op.projectId !== projectId);
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
  } catch {
    // Ignore
  }
}
