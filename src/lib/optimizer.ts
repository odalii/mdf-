import type {
  CutLine,
  EdgeBanding,
  OffcutRect,
  OptimizationResult,
  OptimizedSheet,
  OversizedPartError,
  PartInput,
  PlacedPart,
  SheetConfig,
} from '../types/cutmaster';

export const PART_PALETTE = [
  '#EA580C', // Safety Orange
  '#0284C7', // Blueprint Cyan
  '#0D9488', // Industrial Teal
  '#D97706', // Amber Ochre
  '#4F46E5', // Cobalt Indigo
  '#059669', // Emerald Steel
  '#E11D48', // Crimson Marker
  '#7C3AED', // Violet Ink
  '#2563EB', // CAD Blue
  '#B45309', // Copper Bronze
];

const USABLE_OFFCUT_MIN_DIM = 150; // mm
const USABLE_OFFCUT_MIN_AREA_MM2 = 40000; // 200x200mm equivalent

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ExpandedItem {
  instanceId: string;
  partId: string;
  name: string;
  length: number;
  width: number;
  allowRotation: boolean;
  edgeBanding: EdgeBanding;
  notes: string;
  color: string;
}

type SortStrategy = 'area' | 'maxSide' | 'width' | 'height' | 'perimeter';
type SplitRule = 'shorterLeftover' | 'longerLeftover' | 'minArea';

interface InternalSheet {
  freeRects: FreeRect[];
  placedParts: PlacedPart[];
  cutLines: CutLine[];
}

function expandParts(
  parts: PartInput[],
  usableW: number,
  usableH: number,
  globalRotation: boolean
): { items: ExpandedItem[]; oversized: OversizedPartError[] } {
  const items: ExpandedItem[] = [];
  const oversized: OversizedPartError[] = [];

  parts.forEach((part, idx) => {
    const qty = Math.max(0, Math.floor(Number(part.quantity) || 0));
    const l = Number(part.length) || 0;
    const w = Number(part.width) || 0;
    if (qty <= 0 || l <= 0 || w <= 0) return;

    const canRotate = globalRotation && part.allowRotation;
    const fitsNormal = l <= usableW && w <= usableH;
    const fitsRotated = canRotate && w <= usableW && l <= usableH;

    if (!fitsNormal && !fitsRotated) {
      oversized.push({
        partId: part.id,
        name: part.name || `Part ${idx + 1}`,
        length: l,
        width: w,
        reason: `Exceeds usable sheet area (${usableW} × ${usableH} mm)`,
      });
      return;
    }

    const color = part.color || PART_PALETTE[idx % PART_PALETTE.length];
    for (let q = 0; q < qty; q++) {
      items.push({
        instanceId: `${part.id}__${q + 1}`,
        partId: part.id,
        name: part.name || `Part ${idx + 1}`,
        length: l,
        width: w,
        allowRotation: canRotate,
        edgeBanding: part.edgeBanding,
        notes: part.notes || '',
        color,
      });
    }
  });

  return { items, oversized };
}

function sortItems(items: ExpandedItem[], strategy: SortStrategy): ExpandedItem[] {
  const copy = [...items];
  switch (strategy) {
    case 'area':
      return copy.sort((a, b) => b.length * b.width - a.length * a.width || Math.max(b.length, b.width) - Math.max(a.length, a.width));
    case 'maxSide':
      return copy.sort((a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width) || b.length * b.width - a.length * a.width);
    case 'width':
      return copy.sort((a, b) => b.length - a.length || b.width - a.width);
    case 'height':
      return copy.sort((a, b) => b.width - a.width || b.length - a.length);
    case 'perimeter':
      return copy.sort((a, b) => (b.length + b.width) - (a.length + a.width));
  }
}

function findBestPlacement(
  freeRects: FreeRect[],
  item: ExpandedItem
): { rectIndex: number; w: number; h: number; rotated: boolean; score1: number; score2: number } | null {
  let best: {
    rectIndex: number;
    w: number;
    h: number;
    rotated: boolean;
    score1: number;
    score2: number;
  } | null = null;

  for (let i = 0; i < freeRects.length; i++) {
    const r = freeRects[i];
    // Try normal orientation
    if (item.length <= r.w + 0.001 && item.width <= r.h + 0.001) {
      const leftoverX = r.w - item.length;
      const leftoverY = r.h - item.width;
      const shortSide = Math.min(leftoverX, leftoverY);
      const longSide = Math.max(leftoverX, leftoverY);
      if (
        !best ||
        shortSide < best.score1 ||
        (shortSide === best.score1 && longSide < best.score2)
      ) {
        best = {
          rectIndex: i,
          w: item.length,
          h: item.width,
          rotated: false,
          score1: shortSide,
          score2: longSide,
        };
      }
    }

    // Try 90-degree rotated orientation
    if (item.allowRotation && item.length !== item.width && item.width <= r.w + 0.001 && item.length <= r.h + 0.001) {
      const leftoverX = r.w - item.width;
      const leftoverY = r.h - item.length;
      const shortSide = Math.min(leftoverX, leftoverY);
      const longSide = Math.max(leftoverX, leftoverY);
      if (
        !best ||
        shortSide < best.score1 ||
        (shortSide === best.score1 && longSide < best.score2)
      ) {
        best = {
          rectIndex: i,
          w: item.width,
          h: item.length,
          rotated: true,
          score1: shortSide,
          score2: longSide,
        };
      }
    }
  }

  return best;
}

function splitFreeRectGuillotine(
  rect: FreeRect,
  placedW: number,
  placedH: number,
  kerf: number,
  splitRule: SplitRule,
  sheetIdx: number,
  cutCounter: { val: number }
): { newRects: FreeRect[]; cuts: CutLine[] } {
  const remW = rect.w - placedW;
  const remH = rect.h - placedH;
  const newRects: FreeRect[] = [];
  const cuts: CutLine[] = [];

  // Choose guillotine cut axis: horizontal-first vs vertical-first
  let splitHorizontallyFirst: boolean;
  if (splitRule === 'shorterLeftover') {
    splitHorizontallyFirst = remW <= remH;
  } else if (splitRule === 'longerLeftover') {
    splitHorizontallyFirst = remW > remH;
  } else {
    // minArea: choose split that maximizes the single largest leftover rectangle
    const areaIfHFirst = Math.max(
      (rect.w - placedW - kerf) * placedH,
      rect.w * (rect.h - placedH - kerf)
    );
    const areaIfVFirst = Math.max(
      placedW * (rect.h - placedH - kerf),
      (rect.w - placedW - kerf) * rect.h
    );
    splitHorizontallyFirst = areaIfHFirst >= areaIfVFirst;
  }

  if (splitHorizontallyFirst) {
    // Horizontal cut along y = rect.y + placedH
    if (remH > 0.5) {
      cuts.push({
        id: `cut_${sheetIdx}_${++cutCounter.val}`,
        orientation: 'H',
        x1: rect.x,
        y1: rect.y + placedH,
        x2: rect.x + rect.w,
        y2: rect.y + placedH,
        lengthMm: Math.round(rect.w),
      });
    }
    // Vertical cut inside top strip along x = rect.x + placedW
    if (remW > 0.5) {
      cuts.push({
        id: `cut_${sheetIdx}_${++cutCounter.val}`,
        orientation: 'V',
        x1: rect.x + placedW,
        y1: rect.y,
        x2: rect.x + placedW,
        y2: rect.y + placedH,
        lengthMm: Math.round(placedH),
      });
    }

    const rightW = rect.w - placedW - kerf;
    const bottomH = rect.h - placedH - kerf;

    if (rightW > 1 && placedH > 1) {
      newRects.push({
        x: rect.x + placedW + kerf,
        y: rect.y,
        w: rightW,
        h: placedH,
      });
    }
    if (rect.w > 1 && bottomH > 1) {
      newRects.push({
        x: rect.x,
        y: rect.y + placedH + kerf,
        w: rect.w,
        h: bottomH,
      });
    }
  } else {
    // Vertical cut along x = rect.x + placedW
    if (remW > 0.5) {
      cuts.push({
        id: `cut_${sheetIdx}_${++cutCounter.val}`,
        orientation: 'V',
        x1: rect.x + placedW,
        y1: rect.y,
        x2: rect.x + placedW,
        y2: rect.y + rect.h,
        lengthMm: Math.round(rect.h),
      });
    }
    // Horizontal cut inside left strip along y = rect.y + placedH
    if (remH > 0.5) {
      cuts.push({
        id: `cut_${sheetIdx}_${++cutCounter.val}`,
        orientation: 'H',
        x1: rect.x,
        y1: rect.y + placedH,
        x2: rect.x + placedW,
        y2: rect.y + placedH,
        lengthMm: Math.round(placedW),
      });
    }

    const bottomH = rect.h - placedH - kerf;
    const rightW = rect.w - placedW - kerf;

    if (placedW > 1 && bottomH > 1) {
      newRects.push({
        x: rect.x,
        y: rect.y + placedH + kerf,
        w: placedW,
        h: bottomH,
      });
    }
    if (rightW > 1 && rect.h > 1) {
      newRects.push({
        x: rect.x + placedW + kerf,
        y: rect.y,
        w: rightW,
        h: rect.h,
      });
    }
  }

  return { newRects, cuts };
}

function mergeAdjacentFreeRects(rects: FreeRect[]): FreeRect[] {
  const list = rects.map((r) => ({ ...r }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.w - b.w) < 0.5) {
          if (Math.abs(a.y + a.h - b.y) < 6) {
            a.h = b.y + b.h - a.y;
            list.splice(j, 1);
            merged = true;
            break;
          } else if (Math.abs(b.y + b.h - a.y) < 6) {
            b.h = a.y + a.h - b.y;
            list.splice(i, 1);
            merged = true;
            break;
          }
        }
        if (Math.abs(a.y - b.y) < 0.5 && Math.abs(a.h - b.h) < 0.5) {
          if (Math.abs(a.x + a.w - b.x) < 6) {
            a.w = b.x + b.w - a.x;
            list.splice(j, 1);
            merged = true;
            break;
          } else if (Math.abs(b.x + b.w - a.x) < 6) {
            b.w = a.x + a.w - b.x;
            list.splice(i, 1);
            merged = true;
            break;
          }
        }
      }
      if (merged) break;
    }
  }
  return list;
}

function runHeuristicPass(
  sortedItems: ExpandedItem[],
  sheetLength: number,
  sheetWidth: number,
  trimMargin: number,
  kerf: number,
  splitRule: SplitRule
): InternalSheet[] {
  const usableW = Math.max(1, sheetLength - trimMargin * 2);
  const usableH = Math.max(1, sheetWidth - trimMargin * 2);
  const sheets: InternalSheet[] = [];
  const cutCounter = { val: 0 };

  for (const item of sortedItems) {
    let bestSheetIdx = -1;
    let bestPlacement: ReturnType<typeof findBestPlacement> = null;

    for (let s = 0; s < sheets.length; s++) {
      const candidate = findBestPlacement(sheets[s].freeRects, item);
      if (
        candidate &&
        (!bestPlacement ||
          candidate.score1 < bestPlacement.score1 ||
          (candidate.score1 === bestPlacement.score1 && candidate.score2 < bestPlacement.score2))
      ) {
        bestPlacement = candidate;
        bestSheetIdx = s;
      }
    }

    if (bestSheetIdx === -1 || !bestPlacement) {
      const newSheet: InternalSheet = {
        freeRects: [{ x: trimMargin, y: trimMargin, w: usableW, h: usableH }],
        placedParts: [],
        cutLines: [],
      };
      sheets.push(newSheet);
      bestSheetIdx = sheets.length - 1;
      bestPlacement = findBestPlacement(newSheet.freeRects, item);
    }

    if (!bestPlacement) continue;

    const targetSheet = sheets[bestSheetIdx];
    const targetRect = targetSheet.freeRects[bestPlacement.rectIndex];
    targetSheet.freeRects.splice(bestPlacement.rectIndex, 1);

    targetSheet.placedParts.push({
      instanceId: item.instanceId,
      partId: item.partId,
      name: item.name,
      x: Number(targetRect.x.toFixed(2)),
      y: Number(targetRect.y.toFixed(2)),
      length: bestPlacement.w,
      width: bestPlacement.h,
      origLength: item.length,
      origWidth: item.width,
      rotated: bestPlacement.rotated,
      color: item.color,
      edgeBanding: item.edgeBanding,
      notes: item.notes,
    });

    const { newRects, cuts } = splitFreeRectGuillotine(
      targetRect,
      bestPlacement.w,
      bestPlacement.h,
      kerf,
      splitRule,
      bestSheetIdx + 1,
      cutCounter
    );
    targetSheet.freeRects.push(...newRects);
    targetSheet.cutLines.push(...cuts);
  }

  return sheets;
}

export function optimizeMdfCutting(
  parts: PartInput[],
  config: SheetConfig
): OptimizationResult {
  const sheetLength = Math.max(100, Number(config.length) || 2440);
  const sheetWidth = Math.max(100, Number(config.width) || 1220);
  const trimMargin = Math.max(0, Math.min(100, Number(config.trimMargin) || 0));
  const kerf = Math.max(0, Math.min(25, Number(config.kerf) || 0));
  const costPerSheet = Math.max(0, Number(config.costPerSheet) || 0);

  const usableW = Math.max(1, sheetLength - trimMargin * 2);
  const usableH = Math.max(1, sheetWidth - trimMargin * 2);

  const { items, oversized } = expandParts(
    parts,
    usableW,
    usableH,
    config.allowRotation
  );

  const totalPartsRequested = parts.reduce(
    (acc, p) => acc + Math.max(0, Math.floor(Number(p.quantity) || 0)),
    0
  );

  if (items.length === 0) {
    return {
      sheets: [],
      totalSheets: 0,
      totalPartsRequested,
      totalPartsPlaced: 0,
      usedAreaSqM: 0,
      totalSheetAreaSqM: 0,
      wasteAreaSqM: 0,
      usableOffcutAreaSqM: 0,
      efficiencyPct: 0,
      wastePct: 0,
      totalMaterialCost: 0,
      costPerPart: 0,
      estimatedWasteCost: 0,
      usableOffcutValue: 0,
      oversizedParts: oversized,
      algorithmUsed: 'Guillotine BSSF Multi-Pass',
    };
  }

  const strategies: SortStrategy[] = ['area', 'maxSide', 'width', 'height', 'perimeter'];
  const splitRules: SplitRule[] = ['minArea', 'shorterLeftover', 'longerLeftover'];

  let bestSheets: InternalSheet[] | null = null;
  let bestScore = Infinity;
  let bestLabel = 'Guillotine BSSF (Area)';

  for (const strat of strategies) {
    const sorted = sortItems(items, strat);
    for (const rule of splitRules) {
      const candidate = runHeuristicPass(
        sorted,
        sheetLength,
        sheetWidth,
        trimMargin,
        kerf,
        rule
      );

      // Score: prioritize fewer sheets first, then tighter fill on the final sheet (maximize last sheet empty space for offcuts)
      const lastSheet = candidate[candidate.length - 1];
      const lastUsedArea = lastSheet
        ? lastSheet.placedParts.reduce((sum, p) => sum + p.length * p.width, 0)
        : 0;
      const sheetArea = sheetLength * sheetWidth;
      // Lower score is better: fewer sheets, and on ties prefer packing earlier sheets tightly so last sheet has max contiguous free area
      const score = candidate.length * 1000 + (lastUsedArea / sheetArea);

      if (score < bestScore) {
        bestScore = score;
        bestSheets = candidate;
        bestLabel = `Guillotine BSSF (${strat} · ${rule})`;
      }
    }
  }

  const finalInternal = bestSheets || [];
  const totalAreaPerSheetMm2 = sheetLength * sheetWidth;

  let totalUsedMm2 = 0;
  let totalUsableOffcutSqM = 0;
  let totalPlacedCount = 0;

  const optimizedSheets: OptimizedSheet[] = finalInternal.map((sheet, idx) => {
    const usedMm2 = sheet.placedParts.reduce((s, p) => s + p.length * p.width, 0);
    totalUsedMm2 += usedMm2;
    totalPlacedCount += sheet.placedParts.length;

    const mergedRects = mergeAdjacentFreeRects(sheet.freeRects);
    const offcuts: OffcutRect[] = mergedRects
      .filter((r) => r.w >= 40 && r.h >= 40)
      .map((r, oIdx) => {
        const areaMm2 = r.w * r.h;
        const areaSqM = Number((areaMm2 / 1_000_000).toFixed(4));
        const usable =
          r.w >= USABLE_OFFCUT_MIN_DIM &&
          r.h >= USABLE_OFFCUT_MIN_DIM &&
          areaMm2 >= USABLE_OFFCUT_MIN_AREA_MM2;
        return {
          id: `offcut_${idx + 1}_${oIdx + 1}`,
          x: Number(r.x.toFixed(1)),
          y: Number(r.y.toFixed(1)),
          length: Math.round(r.w),
          width: Math.round(r.h),
          areaSqM,
          usable,
        };
      })
      .sort((a, b) => b.areaSqM - a.areaSqM);

    const sheetUsableOffcutSqM = offcuts
      .filter((o) => o.usable)
      .reduce((s, o) => s + o.areaSqM, 0);
    totalUsableOffcutSqM += sheetUsableOffcutSqM;

    const eff = Number(((usedMm2 / totalAreaPerSheetMm2) * 100).toFixed(2));
    const waste = Number((100 - eff).toFixed(2));

    return {
      sheetIndex: idx + 1,
      sheetLength,
      sheetWidth,
      placedParts: sheet.placedParts,
      offcuts,
      cutLines: sheet.cutLines,
      usedAreaMm2: usedMm2,
      totalAreaMm2: totalAreaPerSheetMm2,
      efficiencyPct: eff,
      wastePct: waste,
      usableOffcutAreaSqM: Number(sheetUsableOffcutSqM.toFixed(3)),
    };
  });

  const totalSheets = optimizedSheets.length;
  const totalSheetAreaSqM = Number(
    ((totalSheets * totalAreaPerSheetMm2) / 1_000_000).toFixed(3)
  );
  const usedAreaSqM = Number((totalUsedMm2 / 1_000_000).toFixed(3));
  const wasteAreaSqM = Number(
    Math.max(0, totalSheetAreaSqM - usedAreaSqM).toFixed(3)
  );
  const efficiencyPct =
    totalSheetAreaSqM > 0
      ? Number(((usedAreaSqM / totalSheetAreaSqM) * 100).toFixed(1))
      : 0;
  const wastePct = Number(Math.max(0, 100 - efficiencyPct).toFixed(1));

  const totalMaterialCost = Number((totalSheets * costPerSheet).toFixed(2));
  const costPerPart =
    totalPlacedCount > 0
      ? Number((totalMaterialCost / totalPlacedCount).toFixed(2))
      : 0;
  const estimatedWasteCost = Number(
    ((wastePct / 100) * totalMaterialCost).toFixed(2)
  );
  const usableOffcutValue =
    totalSheetAreaSqM > 0
      ? Number(
          ((totalUsableOffcutSqM / totalSheetAreaSqM) * totalMaterialCost).toFixed(2)
        )
      : 0;

  return {
    sheets: optimizedSheets,
    totalSheets,
    totalPartsRequested,
    totalPartsPlaced: totalPlacedCount,
    usedAreaSqM,
    totalSheetAreaSqM,
    wasteAreaSqM,
    usableOffcutAreaSqM: Number(totalUsableOffcutSqM.toFixed(3)),
    efficiencyPct,
    wastePct,
    totalMaterialCost,
    costPerPart,
    estimatedWasteCost,
    usableOffcutValue,
    oversizedParts: oversized,
    algorithmUsed: bestLabel,
  };
}
