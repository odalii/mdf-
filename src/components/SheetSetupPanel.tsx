import React from 'react';
import { RotateCw, Ruler } from 'lucide-react';
import type { SheetConfig } from '../types/cutmaster';
import { MDF_SHEET_PRESETS } from '../lib/presets';

interface SheetSetupPanelProps {
  config: SheetConfig;
  currency: string;
  onChange: (next: SheetConfig) => void;
}

export const SheetSetupPanel: React.FC<SheetSetupPanelProps> = ({
  config,
  currency,
  onChange,
}) => {
  const applyPreset = (presetId: string) => {
    const found = MDF_SHEET_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    onChange({
      ...config,
      length: found.length,
      width: found.width,
      thickness: found.thickness,
      materialType: found.materialType,
      costPerSheet: found.costPerSheet,
    });
  };

  const updateNum = (field: keyof SheetConfig, raw: string, min = 0) => {
    const val = parseFloat(raw);
    onChange({
      ...config,
      [field]: Number.isFinite(val) ? Math.max(min, val) : min,
    });
  };

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Ruler className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
          <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
            MDF Sheet Setup
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
            Quick Preset
          </label>
          <select
            aria-label="MDF Sheet Preset"
            value=""
            onChange={(e) => {
              if (e.target.value) applyPreset(e.target.value);
            }}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#22262C] px-2.5 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          >
            <option value="">Select standard board...</option>
            {MDF_SHEET_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Length (mm)
          </label>
          <input
            type="number"
            min={100}
            max={10000}
            value={config.length}
            onChange={(e) => updateNum('length', e.target.value, 100)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Width (mm)
          </label>
          <input
            type="number"
            min={100}
            max={10000}
            value={config.width}
            onChange={(e) => updateNum('width', e.target.value, 100)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Thickness (mm)
          </label>
          <input
            type="number"
            min={1}
            max={200}
            step={0.5}
            value={config.thickness}
            onChange={(e) => updateNum('thickness', e.target.value, 1)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Cost / Sheet ({currency})
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={config.costPerSheet}
            onChange={(e) => updateNum('costPerSheet', e.target.value, 0)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Saw Kerf (mm)
          </label>
          <input
            type="number"
            min={0}
            max={25}
            step={0.1}
            value={config.kerf}
            onChange={(e) => updateNum('kerf', e.target.value, 0)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Edge Trim (mm)
          </label>
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={config.trimMargin}
            onChange={(e) => updateNum('trimMargin', e.target.value, 0)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Material Type
          </label>
          <input
            type="text"
            maxLength={80}
            value={config.materialType}
            onChange={(e) => onChange({ ...config, materialType: e.target.value })}
            placeholder="Standard Raw MDF"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...config, allowRotation: !config.allowRotation })}
          className={`mt-4 flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            config.allowRotation
              ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300'
              : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#22262C] text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>90° Grain Rotation: {config.allowRotation ? 'Enabled' : 'Locked'}</span>
        </button>
      </div>
    </section>
  );
};
