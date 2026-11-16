import * as XLSX from 'xlsx';
import type { EdgeBanding, OptimizationResult, PartInput, SheetConfig } from '../types/cutmaster';
import { PART_PALETTE } from './optimizer';

function formatEdgeBanding(eb: EdgeBanding): string {
  const sides: string[] = [];
  if (eb.top) sides.push('T');
  if (eb.bottom) sides.push('B');
  if (eb.left) sides.push('L');
  if (eb.right) sides.push('R');
  return sides.length > 0 ? sides.join(',') : 'None';
}

function parseEdgeBanding(raw: unknown): EdgeBanding {
  const s = String(raw || '').toUpperCase();
  if (!s || s === 'NONE' || s === '0' || s === 'NO') {
    return { top: false, bottom: false, left: false, right: false };
  }
  if (s.includes('ALL') || s === '4') {
    return { top: true, bottom: true, left: true, right: true };
  }
  return {
    top: s.includes('T') || s.includes('TOP') || s.includes('L1'),
    bottom: s.includes('B') || s.includes('BOT') || s.includes('L2'),
    left: s.includes('L') || s.includes('LEFT') || s.includes('W1'),
    right: s.includes('R') || s.includes('RIGHT') || s.includes('W2'),
  };
}

export async function importPartsFromFile(file: File): Promise<PartInput[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const imported: PartInput[] = [];
  rows.forEach((row, idx) => {
    // Normalize keys case-insensitively
    const norm: Record<string, unknown> = {};
    Object.keys(row).forEach((k) => {
      norm[k.trim().toLowerCase()] = row[k];
    });

    const name = String(
      norm['part name'] ??
        norm['partname'] ??
        norm['name'] ??
        norm['part'] ??
        norm['label'] ??
        norm['description'] ??
        `Imported Part ${idx + 1}`
    ).trim();

    const length = Number(
      norm['length'] ?? norm['length (mm)'] ?? norm['len'] ?? norm['l'] ?? norm['height'] ?? 0
    );
    const width = Number(
      norm['width'] ?? norm['width (mm)'] ?? norm['wid'] ?? norm['w'] ?? 0
    );
    const quantity = Math.max(
      1,
      Math.floor(Number(norm['quantity'] ?? norm['qty'] ?? norm['count'] ?? norm['q'] ?? 1))
    );

    if (length > 0 && width > 0) {
      const rotRaw = String(norm['rotate'] ?? norm['rotation'] ?? norm['allow rotation'] ?? 'yes').toLowerCase();
      const allowRotation = !['no', 'false', '0', 'n'].includes(rotRaw);
      const edgeBanding = parseEdgeBanding(norm['edge banding'] ?? norm['edgebanding'] ?? norm['edges'] ?? '');
      const notes = String(norm['notes'] ?? norm['note'] ?? norm['remarks'] ?? '').slice(0, 140);

      imported.push({
        id: `part_imp_${Date.now()}_${idx}`,
        name: name.slice(0, 80),
        length: Math.round(length * 10) / 10,
        width: Math.round(width * 10) / 10,
        quantity,
        allowRotation,
        edgeBanding,
        notes,
        color: PART_PALETTE[idx % PART_PALETTE.length],
      });
    }
  });

  return imported;
}

export function exportProjectToCSV(
  projectName: string,
  parts: PartInput[]
): void {
  const rows = parts.map((p) => ({
    'Part Name': p.name,
    'Length (mm)': p.length,
    'Width (mm)': p.width,
    Quantity: p.quantity,
    'Allow Rotation': p.allowRotation ? 'Yes' : 'No',
    'Edge Banding': formatEdgeBanding(p.edgeBanding),
    Notes: p.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${sanitizeFilename(projectName)}_parts.csv`);
}

export function exportProjectToExcel(
  projectName: string,
  config: SheetConfig,
  parts: PartInput[],
  result: OptimizationResult,
  currency: string
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Parts List
  const partsRows = parts.map((p, i) => ({
    '#': i + 1,
    'Part Name': p.name,
    'Length (mm)': p.length,
    'Width (mm)': p.width,
    Quantity: p.quantity,
    'Area Each (m2)': Number(((p.length * p.width) / 1_000_000).toFixed(4)),
    'Total Area (m2)': Number(((p.length * p.width * p.quantity) / 1_000_000).toFixed(4)),
    'Allow Rotation': p.allowRotation ? 'Yes' : 'No',
    'Edge Banding': formatEdgeBanding(p.edgeBanding),
    Notes: p.notes || '',
  }));
  const wsParts = XLSX.utils.json_to_sheet(partsRows);
  XLSX.utils.book_append_sheet(wb, wsParts, 'Parts List');

  // Sheet 2: Optimization Summary
  const summaryRows = [
    { Metric: 'Project Name', Value: projectName },
    { Metric: 'Material Type', Value: config.materialType },
    { Metric: 'Sheet Size (mm)', Value: `${config.length} × ${config.width} × ${config.thickness} mm` },
    { Metric: 'Saw Kerf (mm)', Value: config.kerf },
    { Metric: `Cost Per Sheet (${currency})`, Value: config.costPerSheet },
    { Metric: 'Total Sheets Used', Value: result.totalSheets },
    { Metric: 'Total Parts Placed', Value: result.totalPartsPlaced },
    { Metric: 'Used Area (m2)', Value: result.usedAreaSqM },
    { Metric: 'Waste Area (m2)', Value: result.wasteAreaSqM },
    { Metric: 'Usable Offcuts (m2)', Value: result.usableOffcutAreaSqM },
    { Metric: 'Efficiency (%)', Value: result.efficiencyPct },
    { Metric: 'Waste (%)', Value: result.wastePct },
    { Metric: `Total Material Cost (${currency})`, Value: result.totalMaterialCost },
    { Metric: `Average Cost Per Part (${currency})`, Value: result.costPerPart },
    { Metric: `Estimated Waste Cost (${currency})`, Value: result.estimatedWasteCost },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary & Cost');

  // Sheet 3: Cut Coordinates
  const placementRows = result.sheets.flatMap((s) =>
    s.placedParts.map((pp) => ({
      Sheet: `Sheet ${s.sheetIndex}`,
      'Part Name': pp.name,
      'X (mm)': pp.x,
      'Y (mm)': pp.y,
      'Placed Length (mm)': pp.length,
      'Placed Width (mm)': pp.width,
      Rotated: pp.rotated ? '90 deg' : 'No',
      'Edge Banding': formatEdgeBanding(pp.edgeBanding),
    }))
  );
  const wsCuts = XLSX.utils.json_to_sheet(placementRows);
  XLSX.utils.book_append_sheet(wb, wsCuts, 'Cut Coordinates');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `${sanitizeFilename(projectName)}_cutplan.xlsx`);
}

function sanitizeFilename(name: string): string {
  return (name || 'cutmaster_project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'cutmaster_project';
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
