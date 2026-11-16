import React, { useRef, useState } from 'react';
import {
  Copy,
  FileSpreadsheet,
  Plus,
  Redo2,
  RotateCw,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import type { EdgeBanding, PartInput } from '../types/cutmaster';
import { PART_PALETTE } from '../lib/optimizer';
import { importPartsFromFile } from '../lib/importExport';

interface PartsTableProps {
  parts: PartInput[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onChange: (next: PartInput[]) => void;
  onLoadSample: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
}

export const PartsTable: React.FC<PartsTableProps> = ({
  parts,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onChange,
  onLoadSample,
  onExportCSV,
  onExportExcel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newLength, setNewLength] = useState('600');
  const [newWidth, setNewWidth] = useState('400');
  const [newQty, setNewQty] = useState('2');

  const addPart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const l = Math.max(1, Number(newLength) || 0);
    const w = Math.max(1, Number(newWidth) || 0);
    const q = Math.max(1, Math.floor(Number(newQty) || 1));
    if (l <= 0 || w <= 0) return;

    const nextIdx = parts.length;
    const item: PartInput = {
      id: `part_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newName.trim() || `Panel ${nextIdx + 1}`,
      length: l,
      width: w,
      quantity: q,
      allowRotation: true,
      edgeBanding: { top: false, bottom: false, left: false, right: false },
      notes: '',
      color: PART_PALETTE[nextIdx % PART_PALETTE.length],
    };

    onChange([...parts, item]);
    setNewName('');
  };

  const updateRow = (id: string, patch: Partial<PartInput>) => {
    onChange(parts.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const toggleEdge = (id: string, edge: keyof EdgeBanding) => {
    onChange(
      parts.map((p) =>
        p.id === id
          ? { ...p, edgeBanding: { ...p.edgeBanding, [edge]: !p.edgeBanding[edge] } }
          : p
      )
    );
  };

  const duplicateRow = (part: PartInput) => {
    const copy: PartInput = {
      ...part,
      id: `part_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${part.name} (Copy)`,
      color: PART_PALETTE[parts.length % PART_PALETTE.length],
    };
    onChange([...parts, copy]);
  };

  const deleteRow = (id: string) => {
    onChange(parts.filter((p) => p.id !== id));
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(null);
    try {
      const imported = await importPartsFromFile(file);
      if (imported.length === 0) {
        setImportMsg('No valid rows found. Ensure columns include Length, Width, and Quantity.');
      } else {
        onChange([...parts, ...imported]);
        setImportMsg(`Imported ${imported.length} part rows from ${file.name}.`);
      }
    } catch {
      setImportMsg('Unable to read file. Please upload a valid CSV or Excel (.xlsx) file.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalPieceCount = parts.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Parts Cut List
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {parts.length} line items · {totalPieceCount} total pieces
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-[#22262C] p-0.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-md text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-35 transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded-md text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-35 transition-colors cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => void handleFileImport(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#22262C] px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV/Excel</span>
          </button>

          <button
            type="button"
            onClick={onExportCSV}
            disabled={parts.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#22262C] px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onExportExcel}
            disabled={parts.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#22262C] px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={onLoadSample}
            className="rounded-lg border border-orange-500/30 bg-orange-50 dark:bg-orange-950/30 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Load Sample Kit
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="px-4 py-2 bg-zinc-50 dark:bg-[#1E2228] border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
          <span>{importMsg}</span>
          <button
            type="button"
            onClick={() => setImportMsg(null)}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Add Row Form */}
      <form
        onSubmit={addPart}
        className="p-3 bg-zinc-50/80 dark:bg-[#14171A] border-b border-zinc-200 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-12 gap-2 items-end"
      >
        <div className="col-span-2 sm:col-span-4">
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Part Name
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Side Panel"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Length (mm)
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={newLength}
            onChange={(e) => setNewLength(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-2.5 py-1.5 text-xs font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Width (mm)
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={newWidth}
            onChange={(e) => setNewWidth(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-2.5 py-1.5 text-xs font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Qty
          </label>
          <input
            type="number"
            min={1}
            max={5000}
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111315] px-2.5 py-1.5 text-xs font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Part</span>
          </button>
        </div>
      </form>

      {/* Spreadsheet Table */}
      {parts.length === 0 ? (
        <div className="p-10 text-center space-y-3">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No cutting parts added yet
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Add panels above, import an Excel or CSV cut list, or load our sample wardrobe cabinet kit to see live optimization.
          </p>
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 transition-colors cursor-pointer"
          >
            Load Sample Wardrobe Kit
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-[#14171A]">
                <th className="py-2.5 pl-4 pr-2 w-8">#</th>
                <th className="py-2.5 px-2 min-w-[160px]">Part Name</th>
                <th className="py-2.5 px-2 w-24 text-right">Length (mm)</th>
                <th className="py-2.5 px-2 w-24 text-right">Width (mm)</th>
                <th className="py-2.5 px-2 w-20 text-right">Qty</th>
                <th className="py-2.5 px-2 w-32">Edge Banding</th>
                <th className="py-2.5 px-2 w-16 text-center">Rotate</th>
                <th className="py-2.5 px-2 min-w-[130px]">Notes</th>
                <th className="py-2.5 pl-2 pr-4 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 text-xs">
              {parts.map((part, idx) => (
                <tr
                  key={part.id}
                  className="hover:bg-zinc-50 dark:hover:bg-[#1E2228]/70 transition-colors"
                >
                  <td className="py-2 pl-4 pr-2 font-mono tabular-nums text-zinc-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: part.color || PART_PALETTE[idx % PART_PALETTE.length] }}
                      />
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="text"
                      value={part.name}
                      onChange={(e) => updateRow(part.id, { name: e.target.value })}
                      className="w-full rounded border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-orange-500 bg-transparent px-2 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={part.length}
                      onChange={(e) =>
                        updateRow(part.id, {
                          length: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full text-right rounded border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-orange-500 bg-transparent px-2 py-1 font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={part.width}
                      onChange={(e) =>
                        updateRow(part.id, {
                          width: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full text-right rounded border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-orange-500 bg-transparent px-2 py-1 font-mono tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={part.quantity}
                      onChange={(e) =>
                        updateRow(part.id, {
                          quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                        })
                      }
                      className="w-full text-right rounded border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-orange-500 bg-transparent px-2 py-1 font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-1">
                      {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
                        const active = part.edgeBanding[side];
                        const shortLabel = side[0].toUpperCase();
                        return (
                          <button
                            key={side}
                            type="button"
                            onClick={() => toggleEdge(part.id, side)}
                            title={`Toggle ${side} edge banding`}
                            className={`w-6 h-6 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                              active
                                ? 'bg-orange-600 text-white'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => updateRow(part.id, { allowRotation: !part.allowRotation })}
                      title={part.allowRotation ? 'Rotation allowed' : 'Grain locked'}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        part.allowRotation
                          ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30'
                          : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800'
                      }`}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="text"
                      value={part.notes}
                      placeholder="Add note..."
                      onChange={(e) => updateRow(part.id, { notes: e.target.value })}
                      className="w-full rounded border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-orange-500 bg-transparent px-2 py-1 text-xs text-zinc-600 dark:text-zinc-300 focus:outline-none"
                    />
                  </td>
                  <td className="py-1.5 pl-2 pr-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => duplicateRow(part)}
                        title="Duplicate row"
                        className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(part.id)}
                        title="Delete row"
                        className="p-1.5 rounded text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
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
  );
};
