import React, { useEffect, useRef, useState } from 'react';
import {
  Grid2x2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scissors,
  Square,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { OptimizationResult, OptimizedSheet, PlacedPart } from '../types/cutmaster';

interface CuttingCanvasProps {
  result: OptimizationResult;
  kerf: number;
}

export const CuttingCanvas: React.FC<CuttingCanvasProps> = ({ result, kerf }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [showCuts, setShowCuts] = useState(true);
  const [showOffcuts, setShowOffcuts] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PlacedPart | null>(null);

  useEffect(() => {
    if (activeSheetIdx >= result.sheets.length && result.sheets.length > 0) {
      setActiveSheetIdx(0);
    }
  }, [result.sheets.length, activeSheetIdx]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch {
        setIsFullscreen((v) => !v);
      }
    } else {
      await document.exitFullscreen();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (viewMode !== 'single') return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.14 : -0.14;
    setZoom((z) => Math.min(4, Math.max(0.4, Number((z + delta).toFixed(2)))));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (viewMode !== 'single') return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || viewMode !== 'single') return;
    setPan({
      x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
    });
  };

  const handlePointerUp = () => setIsDragging(false);

  const activeSheet: OptimizedSheet | undefined = result.sheets[activeSheetIdx];

  const renderSheetSvg = (sheet: OptimizedSheet, compact = false) => {
    const pad = compact ? 20 : 72;
    const vbW = sheet.sheetLength + pad * 2;
    const vbH = sheet.sheetWidth + pad * 2;

    return (
      <svg
        viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
        className="w-full h-full select-none"
      >
        <defs>
          <pattern
            id={`offcutHatch_${sheet.sheetIndex}`}
            width="24"
            height="24"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="24" stroke="#10B981" strokeWidth="2" strokeOpacity="0.3" />
          </pattern>
        </defs>

        {/* Sheet Outer Dimensions Header */}
        {!compact && (
          <>
            <text
              x={sheet.sheetLength / 2}
              y={-24}
              textAnchor="middle"
              className="fill-zinc-500 dark:fill-zinc-400 font-mono"
              fontSize={Math.max(26, sheet.sheetLength * 0.015)}
              fontWeight="600"
            >
              {sheet.sheetLength} mm
            </text>
            <text
              x={-28}
              y={sheet.sheetWidth / 2}
              textAnchor="middle"
              transform={`rotate(-90 -28 ${sheet.sheetWidth / 2})`}
              className="fill-zinc-500 dark:fill-zinc-400 font-mono"
              fontSize={Math.max(26, sheet.sheetLength * 0.015)}
              fontWeight="600"
            >
              {sheet.sheetWidth} mm
            </text>
          </>
        )}

        {/* Raw MDF Board Base */}
        <rect
          x={0}
          y={0}
          width={sheet.sheetLength}
          height={sheet.sheetWidth}
          className="fill-amber-50/70 dark:fill-[#1F2329] stroke-zinc-700 dark:stroke-zinc-500"
          strokeWidth={Math.max(3, sheet.sheetLength * 0.002)}
        />

        {/* Usable Offcuts Overlay */}
        {showOffcuts &&
          sheet.offcuts.map((offcut) =>
            offcut.usable ? (
              <g key={offcut.id}>
                <rect
                  x={offcut.x}
                  y={offcut.y}
                  width={offcut.length}
                  height={offcut.width}
                  fill={`url(#offcutHatch_${sheet.sheetIndex})`}
                  stroke="#10B981"
                  strokeWidth={Math.max(2, sheet.sheetLength * 0.0012)}
                  strokeDasharray="14 10"
                />
                {!compact && offcut.length > 210 && offcut.width > 120 && (
                  <text
                    x={offcut.x + offcut.length / 2}
                    y={offcut.y + offcut.width / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-emerald-700 dark:fill-emerald-400 font-mono"
                    fontSize={Math.min(34, Math.max(18, offcut.width * 0.14))}
                    fontWeight="600"
                  >
                    Offcut {offcut.length}×{offcut.width}
                  </text>
                )}
              </g>
            ) : null
          )}

        {/* Placed Parts */}
        {sheet.placedParts.map((part) => {
          const isSelected =
            selectedPart &&
            (selectedPart.instanceId === part.instanceId ||
              selectedPart.partId === part.partId);
          const fontSizeName = Math.min(
            38,
            Math.max(18, Math.min(part.length * 0.08, part.width * 0.22))
          );
          const fontSizeDim = Math.max(15, fontSizeName * 0.78);
          const edgeThickness = Math.max(5, sheet.sheetLength * 0.003);

          return (
            <g
              key={part.instanceId}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPart(part);
              }}
              className="cursor-pointer"
            >
              <rect
                x={part.x}
                y={part.y}
                width={part.length}
                height={part.width}
                fill={part.color}
                fillOpacity={isSelected ? 0.34 : 0.18}
                stroke={isSelected ? '#EA580C' : part.color}
                strokeWidth={
                  isSelected
                    ? Math.max(6, sheet.sheetLength * 0.0035)
                    : Math.max(2.5, sheet.sheetLength * 0.0015)
                }
              />

              {/* Edge Banding Indicators (Solid Orange Edge Bars) */}
              {part.edgeBanding.top && (
                <line
                  x1={part.x}
                  y1={part.y + edgeThickness / 2}
                  x2={part.x + part.length}
                  y2={part.y + edgeThickness / 2}
                  stroke="#EA580C"
                  strokeWidth={edgeThickness}
                />
              )}
              {part.edgeBanding.bottom && (
                <line
                  x1={part.x}
                  y1={part.y + part.width - edgeThickness / 2}
                  x2={part.x + part.length}
                  y2={part.y + part.width - edgeThickness / 2}
                  stroke="#EA580C"
                  strokeWidth={edgeThickness}
                />
              )}
              {part.edgeBanding.left && (
                <line
                  x1={part.x + edgeThickness / 2}
                  y1={part.y}
                  x2={part.x + edgeThickness / 2}
                  y2={part.y + part.width}
                  stroke="#EA580C"
                  strokeWidth={edgeThickness}
                />
              )}
              {part.edgeBanding.right && (
                <line
                  x1={part.x + part.length - edgeThickness / 2}
                  y1={part.y}
                  x2={part.x + part.length - edgeThickness / 2}
                  y2={part.y + part.width}
                  stroke="#EA580C"
                  strokeWidth={edgeThickness}
                />
              )}

              {/* Part Labels & Dimensions */}
              {!compact && part.length > 130 && part.width > 75 && (
                <>
                  <text
                    x={part.x + part.length / 2}
                    y={part.y + part.width / 2 - fontSizeDim * 0.45}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-zinc-900 dark:fill-zinc-100 font-display"
                    fontSize={fontSizeName}
                    fontWeight="700"
                  >
                    {part.name.length > 18 ? `${part.name.slice(0, 16)}…` : part.name}
                  </text>
                  <text
                    x={part.x + part.length / 2}
                    y={part.y + part.width / 2 + fontSizeName * 0.68}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-zinc-600 dark:fill-zinc-300 font-mono"
                    fontSize={fontSizeDim}
                    fontWeight="500"
                  >
                    {part.length} × {part.width}
                    {part.rotated ? ' ↻' : ''}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Saw Kerf & Guillotine Cut Lines */}
        {showCuts &&
          !compact &&
          sheet.cutLines.map((cut) => (
            <line
              key={cut.id}
              x1={cut.x1}
              y1={cut.y1}
              x2={cut.x2}
              y2={cut.y2}
              stroke="#F97316"
              strokeOpacity={0.55}
              strokeWidth={Math.max(kerf, 2.5)}
              strokeDasharray="16 10"
            />
          ))}
      </svg>
    );
  };

  return (
    <section
      ref={containerRef}
      className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] flex flex-col overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* CAD Viewer Header Toolbar */}
      <div className="p-3 sm:p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100 mr-2">
            Cutting Plan Viewer
          </h3>

          {result.sheets.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto max-w-full">
              {result.sheets.map((s, idx) => (
                <button
                  key={s.sheetIndex}
                  type="button"
                  onClick={() => {
                    setActiveSheetIdx(idx);
                    setViewMode('single');
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewMode === 'single' && activeSheetIdx === idx
                      ? 'bg-orange-600 text-white'
                      : 'bg-zinc-100 dark:bg-[#22262C] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  Sheet {s.sheetIndex} ({s.efficiencyPct}%)
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCuts((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showCuts
                ? 'border-orange-500/40 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Cut Lines</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOffcuts((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showOffcuts
                ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Offcuts</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'single' ? 'grid' : 'single'))}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-[#22262C] px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Grid2x2 className="w-3.5 h-3.5" />
            <span>{viewMode === 'single' ? 'All Sheets' : 'Single Sheet'}</span>
          </button>

          {viewMode === 'single' && (
            <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-[#22262C] p-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.2).toFixed(2))))}
                title="Zoom out"
                className="p-1.5 rounded text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-[11px] font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, Number((z + 0.2).toFixed(2))))}
                title="Zoom in"
                className="p-1.5 rounded text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={resetView}
                title="Fit to screen"
                className="p-1.5 rounded text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            title="Toggle fullscreen"
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-[#22262C] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Oversized Part Warning */}
      {result.oversizedParts.length > 0 && (
        <div className="px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
          <strong>Oversized Parts Skipped:</strong>{' '}
          {result.oversizedParts.map((o) => `${o.name} (${o.length}×${o.width} mm)`).join(', ')}
        </div>
      )}

      {/* Interactive Canvas Viewport */}
      {result.sheets.length === 0 ? (
        <div className="h-[360px] flex items-center justify-center bg-zinc-50 dark:bg-[#111315] text-sm text-zinc-500 dark:text-zinc-400">
          Add parts to generate real-time cutting diagrams.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 dark:bg-[#111315] overflow-y-auto max-h-[640px]">
          {result.sheets.map((sheet, idx) => (
            <div
              key={sheet.sheetIndex}
              onClick={() => {
                setActiveSheetIdx(idx);
                setViewMode('single');
              }}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181B1F] p-3 hover:border-orange-500 transition-colors cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  Sheet #{sheet.sheetIndex}
                </span>
                <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  {sheet.placedParts.length} parts · {sheet.efficiencyPct}% used
                </span>
              </div>
              <div className="h-52 w-full">{renderSheetSvg(sheet, true)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={`relative bg-zinc-100 dark:bg-[#111315] overflow-hidden touch-none ${
            isFullscreen ? 'flex-1' : 'h-[420px] sm:h-[520px]'
          } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {activeSheet && (
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
              className="w-full h-full flex items-center justify-center p-4 transition-transform duration-75 ease-out"
            >
              {renderSheetSvg(activeSheet, false)}
            </div>
          )}

          {/* Legend & Selected Part Inspector Overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-[#181B1F]/95 px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-300 shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-orange-600 inline-block" /> Edge Banding
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-orange-500 inline-block" /> Saw Cut ({kerf}mm)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-emerald-500/20 border border-emerald-500 border-dashed inline-block" /> Usable Offcut
              </span>
            </div>

            {selectedPart && (
              <div className="pointer-events-auto rounded-lg border border-orange-500/40 bg-white/95 dark:bg-[#181B1F]/95 px-3.5 py-2 text-xs shadow-md flex items-center gap-4">
                <div>
                  <div className="font-bold text-zinc-900 dark:text-zinc-100">
                    {selectedPart.name}
                  </div>
                  <div className="font-mono tabular-nums text-[11px] text-zinc-500 dark:text-zinc-400">
                    {selectedPart.length} × {selectedPart.width} mm · Pos ({selectedPart.x}, {selectedPart.y})
                    {selectedPart.rotated ? ' · Rotated 90°' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPart(null)}
                  className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offcuts Summary Strip */}
      {activeSheet && activeSheet.offcuts.filter((o) => o.usable).length > 0 && (
        <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#14171A] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Sheet #{activeSheet.sheetIndex} Reusable Offcuts:
          </span>
          {activeSheet.offcuts
            .filter((o) => o.usable)
            .slice(0, 6)
            .map((o) => (
              <span key={o.id} className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {o.length}×{o.width} mm ({o.areaSqM} m²)
              </span>
            ))}
        </div>
      )}
    </section>
  );
};
