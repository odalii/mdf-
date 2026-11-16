import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  Save,
  Share2,
} from 'lucide-react';
import type {
  CompanySettings,
  CuttingProject,
  PartInput,
  SheetConfig,
} from '../types/cutmaster';
import { optimizeMdfCutting } from '../lib/optimizer';
import { createSampleCabinetParts } from '../lib/presets';
import { exportProjectToCSV, exportProjectToExcel } from '../lib/importExport';
import { SheetSetupPanel } from './SheetSetupPanel';
import { PartsTable } from './PartsTable';
import { CostAnalysisPanel } from './CostAnalysisPanel';
import { CuttingCanvas } from './CuttingCanvas';
import { ReportsModal } from './ReportsModal';

interface HistorySnapshot {
  sheetConfig: SheetConfig;
  parts: PartInput[];
}

interface ProjectStudioViewProps {
  project: CuttingProject;
  settings: CompanySettings;
  isCloudUser: boolean;
  saveState: 'saved' | 'saving' | 'offline' | 'idle';
  onUpdateProject: (updated: CuttingProject) => void;
  onShareProject: (project: CuttingProject) => Promise<string | null>;
}

export const ProjectStudioView: React.FC<ProjectStudioViewProps> = ({
  project,
  settings,
  isCloudUser,
  saveState,
  onUpdateProject,
  onShareProject,
}) => {
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);
  const [showReports, setShowReports] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const prevProjectIdRef = useRef(project.id);
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      setUndoStack([]);
      setRedoStack([]);
      setShareUrl(null);
    }
  }, [project.id]);

  const result = useMemo(
    () => optimizeMdfCutting(project.parts, project.sheetConfig),
    [project.parts, project.sheetConfig]
  );

  // Sync calculated summary back onto project cleanly when optimization values change
  const lastSummaryKey = useRef('');
  useEffect(() => {
    const key = `${result.totalSheets}|${result.efficiencyPct}|${result.totalMaterialCost}|${result.totalPartsPlaced}`;
    if (key !== lastSummaryKey.current) {
      lastSummaryKey.current = key;
      if (
        project.summary.totalSheets !== result.totalSheets ||
        project.summary.efficiencyPct !== result.efficiencyPct ||
        project.summary.totalMaterialCost !== result.totalMaterialCost ||
        project.summary.totalPartsPlaced !== result.totalPartsPlaced
      ) {
        onUpdateProject({
          ...project,
          status: result.totalSheets > 0 ? 'optimized' : 'draft',
          summary: {
            totalSheets: result.totalSheets,
            efficiencyPct: result.efficiencyPct,
            wastePct: result.wastePct,
            totalMaterialCost: result.totalMaterialCost,
            usedAreaSqM: result.usedAreaSqM,
            wasteAreaSqM: result.wasteAreaSqM,
            totalPartsPlaced: result.totalPartsPlaced,
          },
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }, [result, project, onUpdateProject]);

  const commitWithHistory = useCallback(
    (nextSheetConfig: SheetConfig, nextParts: PartInput[]) => {
      setUndoStack((prev) => [
        ...prev.slice(-29),
        { sheetConfig: project.sheetConfig, parts: project.parts },
      ]);
      setRedoStack([]);
      onUpdateProject({
        ...project,
        sheetConfig: nextSheetConfig,
        parts: nextParts,
        updatedAt: new Date().toISOString(),
      });
    },
    [project, onUpdateProject]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [
      ...r,
      { sheetConfig: project.sheetConfig, parts: project.parts },
    ]);
    setUndoStack((u) => u.slice(0, -1));
    onUpdateProject({
      ...project,
      sheetConfig: prev.sheetConfig,
      parts: prev.parts,
      updatedAt: new Date().toISOString(),
    });
  }, [undoStack, project, onUpdateProject]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [
      ...u,
      { sheetConfig: project.sheetConfig, parts: project.parts },
    ]);
    setRedoStack((r) => r.slice(0, -1));
    onUpdateProject({
      ...project,
      sheetConfig: next.sheetConfig,
      parts: next.parts,
      updatedAt: new Date().toISOString(),
    });
  }, [redoStack, project, onUpdateProject]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const handleShareClick = async () => {
    setSharing(true);
    try {
      const shareId = await onShareProject(project);
      if (shareId) {
        const url = `${window.location.origin}/?share=${encodeURIComponent(shareId)}`;
        setShareUrl(url);
      }
    } finally {
      setSharing(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const currency = settings.currency || '$';

  return (
    <div className="space-y-5">
      {/* Project Metadata & Action Bar */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
              Project Title
            </label>
            <input
              type="text"
              maxLength={120}
              value={project.name}
              onChange={(e) =>
                onUpdateProject({
                  ...project,
                  name: e.target.value,
                  updatedAt: new Date().toISOString(),
                })
              }
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-[#111315] px-3 py-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
              Customer / Job Reference
            </label>
            <input
              type="text"
              maxLength={120}
              value={project.customerName}
              placeholder="Client or job reference..."
              onChange={(e) =>
                onUpdateProject({
                  ...project,
                  customerName: e.target.value,
                  updatedAt: new Date().toISOString(),
                })
              }
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-[#111315] px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mr-1">
            <Save className="w-3.5 h-3.5" />
            <span>
              {saveState === 'saving' && 'Saving...'}
              {saveState === 'saved' && 'Auto-saved'}
              {saveState === 'offline' && 'Cached locally'}
              {saveState === 'idle' && 'Ready'}
            </span>
          </span>

          <button
            type="button"
            disabled={sharing}
            onClick={() => void handleShareClick()}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#22262C] px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{sharing ? 'Sharing...' : 'Share Link'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReports(true)}
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Report</span>
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/30 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-sky-900 dark:text-sky-200">
              Shareable Cut Plan Link:{' '}
            </span>
            <span className="font-mono text-sky-700 dark:text-sky-300 break-all">
              {shareUrl}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleCopyShareUrl()}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-500 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShareUrl(null)}
              className="text-sky-700 dark:text-sky-300 hover:underline px-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Real-time Cost & Efficiency KPIs */}
      <CostAnalysisPanel
        result={result}
        config={project.sheetConfig}
        currency={currency}
      />

      {/* MDF Sheet Setup */}
      <SheetSetupPanel
        config={project.sheetConfig}
        currency={currency}
        onChange={(nextCfg) => commitWithHistory(nextCfg, project.parts)}
      />

      {/* Interactive Cutting Plan Viewer */}
      <CuttingCanvas result={result} kerf={project.sheetConfig.kerf} />

      {/* Parts Cut List Manager */}
      <PartsTable
        parts={project.parts}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onChange={(nextParts) => commitWithHistory(project.sheetConfig, nextParts)}
        onLoadSample={() =>
          commitWithHistory(project.sheetConfig, createSampleCabinetParts())
        }
        onExportCSV={() => exportProjectToCSV(project.name, project.parts)}
        onExportExcel={() =>
          exportProjectToExcel(
            project.name,
            project.sheetConfig,
            project.parts,
            result,
            currency
          )
        }
      />

      {showReports && (
        <ReportsModal
          project={project}
          result={result}
          settings={settings}
          isCloudUser={isCloudUser}
          onClose={() => setShowReports(false)}
        />
      )}
    </div>
  );
};
