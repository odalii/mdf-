import React from 'react';
import { Coins, Layers, Percent, Recycle } from 'lucide-react';
import type { OptimizationResult, SheetConfig } from '../types/cutmaster';

interface CostAnalysisPanelProps {
  result: OptimizationResult;
  config: SheetConfig;
  currency: string;
}

export const CostAnalysisPanel: React.FC<CostAnalysisPanelProps> = ({
  result,
  config,
  currency,
}) => {
  const usedPct = result.efficiencyPct;
  const offcutPct =
    result.totalSheetAreaSqM > 0
      ? Number(((result.usableOffcutAreaSqM / result.totalSheetAreaSqM) * 100).toFixed(1))
      : 0;
  const scrapPct = Math.max(0, Number((100 - usedPct - offcutPct).toFixed(1)));

  const cards = [
    {
      label: 'Sheets Required',
      value: `${result.totalSheets}`,
      sub: `${result.totalPartsPlaced} / ${result.totalPartsRequested} parts placed`,
      icon: Layers,
    },
    {
      label: 'Material Efficiency',
      value: `${result.efficiencyPct}%`,
      sub: `${result.usedAreaSqM} m² used of ${result.totalSheetAreaSqM} m²`,
      icon: Percent,
    },
    {
      label: 'Total Material Cost',
      value: `${currency}${result.totalMaterialCost.toFixed(2)}`,
      sub: `${currency}${config.costPerSheet.toFixed(2)} per sheet · ${currency}${result.costPerPart.toFixed(2)} / part`,
      icon: Coins,
    },
    {
      label: 'Waste & Offcut Analysis',
      value: `${result.wastePct}%`,
      sub: `Waste ${currency}${result.estimatedWasteCost.toFixed(2)} · Offcuts ${result.usableOffcutAreaSqM} m²`,
      icon: Recycle,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-medium">{card.label}</span>
                <Icon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="font-display text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {card.value}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums truncate">
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Material Utilization Stacked Bar */}
      {result.totalSheets > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              Board Utilization Breakdown
            </span>
            <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
              {result.algorithmUsed}
            </span>
          </div>
          <div className="h-3.5 w-full rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex">
            <div
              style={{ width: `${usedPct}%` }}
              className="bg-orange-600 h-full transition-all duration-300"
              title={`Net Parts: ${usedPct}%`}
            />
            <div
              style={{ width: `${offcutPct}%` }}
              className="bg-emerald-500 h-full transition-all duration-300"
              title={`Reusable Offcuts: ${offcutPct}%`}
            />
            <div
              style={{ width: `${scrapPct}%` }}
              className="bg-zinc-300 dark:bg-zinc-600 h-full transition-all duration-300"
              title={`Saw Kerf & Scrap: ${scrapPct}%`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-600" />
              Net Parts ({usedPct}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              Reusable Offcuts ({offcutPct}% · {currency}{result.usableOffcutValue.toFixed(2)})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-zinc-400 dark:bg-zinc-600" />
              Kerf &amp; Scrap ({scrapPct}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
