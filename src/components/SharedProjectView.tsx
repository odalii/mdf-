import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Layers } from 'lucide-react';
import type { SharedProjectSnapshot } from '../types/cutmaster';
import { fetchSharedProject } from '../lib/firestoreService';
import { optimizeMdfCutting } from '../lib/optimizer';
import { CuttingCanvas } from './CuttingCanvas';
import { CostAnalysisPanel } from './CostAnalysisPanel';

interface SharedProjectViewProps {
  shareId: string;
  onExitShare: () => void;
}

export const SharedProjectView: React.FC<SharedProjectViewProps> = ({
  shareId,
  onExitShare,
}) => {
  const [snapshot, setSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchSharedProject(shareId)
      .then((res) => {
        if (!res) setError('Shared cutting plan not found or link has expired.');
        else setSnapshot(res);
      })
      .catch(() => setError('Unable to load shared cutting plan.'))
      .finally(() => setLoading(false));
  }, [shareId]);

  const result = useMemo(() => {
    if (!snapshot) return null;
    return optimizeMdfCutting(snapshot.parts, snapshot.sheetConfig);
  }, [snapshot]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#111315] text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-base font-bold whitespace-nowrap">
            CutMaster MDF Optimizer
          </span>
        </div>
        <button
          type="button"
          onClick={onExitShare}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Open Full Workspace</span>
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            Loading shared cutting layout...
          </div>
        ) : error || !snapshot || !result ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {error || 'Cutting plan unavailable'}
            </p>
            <button
              type="button"
              onClick={onExitShare}
              className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 cursor-pointer"
            >
              Return to CutMaster
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold">{snapshot.name}</h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {snapshot.companyName ? `${snapshot.companyName} · ` : ''}
                  {snapshot.sheetConfig.materialType} · {snapshot.sheetConfig.length} × {snapshot.sheetConfig.width} × {snapshot.sheetConfig.thickness} mm
                </p>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Read-only shared plan
              </span>
            </div>

            <CostAnalysisPanel
              result={result}
              config={snapshot.sheetConfig}
              currency="$"
            />
            <CuttingCanvas result={result} kerf={snapshot.sheetConfig.kerf} />
          </>
        )}
      </main>
    </div>
  );
};
