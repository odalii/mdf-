import React, { useMemo, useState } from 'react';
import {
  Copy,
  FolderOpen,
  Layers,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import type { CuttingProject } from '../types/cutmaster';

interface DashboardViewProps {
  projects: CuttingProject[];
  currency: string;
  loading: boolean;
  onCreateProject: () => void;
  onOpenProject: (project: CuttingProject) => void;
  onDuplicateProject: (project: CuttingProject) => void;
  onDeleteProject: (projectId: string) => void;
  onShareProject: (project: CuttingProject) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  currency,
  loading,
  onCreateProject,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  onShareProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const totalSheets = projects.reduce((s, p) => s + (p.summary?.totalSheets || 0), 0);
    const activeProjects = projects.filter((p) => (p.summary?.totalSheets || 0) > 0);
    const avgEff =
      activeProjects.length > 0
        ? Number(
            (
              activeProjects.reduce((s, p) => s + (p.summary?.efficiencyPct || 0), 0) /
              activeProjects.length
            ).toFixed(1)
          )
        : 0;
    const avgWaste =
      activeProjects.length > 0 ? Number((100 - avgEff).toFixed(1)) : 0;
    return { totalProjects, totalSheets, avgEff, avgWaste };
  }, [projects]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.customerName || '').toLowerCase().includes(q) ||
        (p.sheetConfig?.materialType || '').toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const chartProjects = useMemo(() => projects.slice(0, 8).reverse(), [projects]);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Workshop Dashboard
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Track material yield, waste reduction, and saved MDF cutting plans across your shop.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateProject}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Optimization Project</span>
        </button>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-5 space-y-1">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Total Projects
          </div>
          <div className="font-display text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {stats.totalProjects}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Synced projects in workspace
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-5 space-y-1">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Total Sheets Optimized
          </div>
          <div className="font-display text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {stats.totalSheets}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Full MDF &amp; panel boards planned
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-5 space-y-1">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Avg. Material Efficiency
          </div>
          <div className="font-display text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.avgEff}%
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Net yield across active jobs
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-5 space-y-1">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Avg. Waste Percentage
          </div>
          <div className="font-display text-3xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
            {stats.avgWaste}%
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Includes kerf &amp; offcut remainder
          </div>
        </div>
      </div>

      {/* Responsive Efficiency vs Waste Chart */}
      {chartProjects.length > 0 && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Project Yield vs. Waste Overview
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Efficiency percentage across your {chartProjects.length} most recent jobs
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-orange-600" /> Yield %
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-zinc-300 dark:bg-zinc-700" /> Waste %
              </span>
            </div>
          </div>

          <div className="relative h-52 w-full">
            <svg viewBox="0 0 800 190" className="w-full h-full overflow-visible">
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = 155 - (pct / 100) * 135;
                return (
                  <g key={pct}>
                    <line
                      x1={42}
                      y1={y}
                      x2={790}
                      y2={y}
                      className="stroke-zinc-200 dark:stroke-zinc-800"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={34}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-zinc-400 font-mono"
                      fontSize="10"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {chartProjects.map((p, idx) => {
                const slotW = (790 - 52) / chartProjects.length;
                const barW = Math.min(48, slotW * 0.56);
                const x = 52 + idx * slotW + (slotW - barW) / 2;
                const eff = Math.min(100, Math.max(0, p.summary?.efficiencyPct || 0));
                const effH = (eff / 100) * 135;
                const wasteH = 135 - effH;
                const isHov = hoveredIdx === idx;

                return (
                  <g
                    key={p.id}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => onOpenProject(p)}
                    className="cursor-pointer"
                  >
                    {/* Waste bar */}
                    <rect
                      x={x}
                      y={20}
                      width={barW}
                      height={wasteH}
                      rx={3}
                      className="fill-zinc-200 dark:fill-zinc-800"
                    />
                    {/* Yield bar */}
                    <rect
                      x={x}
                      y={155 - effH}
                      width={barW}
                      height={effH}
                      rx={3}
                      className={isHov ? 'fill-orange-500' : 'fill-orange-600'}
                    />
                    <text
                      x={x + barW / 2}
                      y={173}
                      textAnchor="middle"
                      className="fill-zinc-500 dark:fill-zinc-400"
                      fontSize="10"
                    >
                      {p.name.length > 12 ? `${p.name.slice(0, 11)}…` : p.name}
                    </text>
                    {isHov && (
                      <text
                        x={x + barW / 2}
                        y={Math.max(14, 155 - effH - 6)}
                        textAnchor="middle"
                        className="fill-zinc-900 dark:fill-white font-mono"
                        fontSize="10"
                        fontWeight="700"
                      >
                        {eff}%
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </section>
      )}

      {/* Projects Table with Search */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Recently Opened Projects
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects, customers, material..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#111315] pl-9 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Layers className="w-8 h-8 text-zinc-400 mx-auto" />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {projects.length === 0
                ? 'No MDF optimization projects yet'
                : 'No projects match your search'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Create your first project to define board sizes, import parts, and optimize sheet layouts.
            </p>
            {projects.length === 0 && (
              <button
                type="button"
                onClick={onCreateProject}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Project</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-[#14171A]">
                  <th className="py-2.5 pl-4 pr-3">Project Name</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Sheet Spec</th>
                  <th className="py-2.5 px-3 text-right">Sheets</th>
                  <th className="py-2.5 px-3 text-right">Efficiency</th>
                  <th className="py-2.5 px-3 text-right">Material Cost</th>
                  <th className="py-2.5 px-3">Updated</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 text-xs">
                {filtered.map((proj) => (
                  <tr
                    key={proj.id}
                    className="hover:bg-zinc-50 dark:hover:bg-[#1E2228]/70 transition-colors"
                  >
                    <td className="py-3 pl-4 pr-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      <button
                        type="button"
                        onClick={() => onOpenProject(proj)}
                        className="hover:text-orange-600 dark:hover:text-orange-400 text-left cursor-pointer"
                      >
                        {proj.name}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                      {proj.customerName || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                      {proj.sheetConfig.length}×{proj.sheetConfig.width}×{proj.sheetConfig.thickness} mm
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                      {proj.summary?.totalSheets ?? 0}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {proj.summary?.efficiencyPct ?? 0}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                      {currency}{(proj.summary?.totalMaterialCost ?? 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                      {new Date(proj.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenProject(proj)}
                          title="Open in Studio"
                          className="p-1.5 rounded text-zinc-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicateProject(proj)}
                          title="Duplicate Project"
                          className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onShareProject(proj)}
                          title="Share Link"
                          className="p-1.5 rounded text-zinc-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProject(proj.id)}
                          title="Delete Project"
                          className="p-1.5 rounded text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
