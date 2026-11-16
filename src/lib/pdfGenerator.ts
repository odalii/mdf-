import { jsPDF } from 'jspdf';
import type {
  CompanySettings,
  CuttingProject,
  OptimizationResult,
  OptimizedSheet,
} from '../types/cutmaster';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [234, 88, 12];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function drawSheetDiagramOnPdf(
  doc: jsPDF,
  sheet: OptimizedSheet,
  x: number,
  y: number,
  maxW: number,
  maxH: number
) {
  const scale = Math.min(maxW / sheet.sheetLength, maxH / sheet.sheetWidth);
  const drawW = sheet.sheetLength * scale;
  const drawH = sheet.sheetWidth * scale;

  // Sheet header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 27, 31);
  doc.text(
    `Sheet #${sheet.sheetIndex}  —  ${sheet.sheetLength} × ${sheet.sheetWidth} mm  (${sheet.efficiencyPct}% Used · ${sheet.wastePct}% Waste)`,
    x,
    y - 3
  );

  // Sheet background
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(55, 65, 81);
  doc.setLineWidth(0.5);
  doc.rect(x, y, drawW, drawH, 'FD');

  // Offcuts
  sheet.offcuts.forEach((offcut) => {
    if (!offcut.usable) return;
    const ox = x + offcut.x * scale;
    const oy = y + offcut.y * scale;
    const ow = offcut.length * scale;
    const oh = offcut.width * scale;
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.25);
    doc.rect(ox, oy, ow, oh, 'FD');
    if (ow > 18 && oh > 8) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(4, 120, 87);
      doc.text(`${offcut.length}×${offcut.width}`, ox + ow / 2, oy + oh / 2 + 1.5, {
        align: 'center',
      });
    }
  });

  // Placed Parts
  sheet.placedParts.forEach((part) => {
    const px = x + part.x * scale;
    const py = y + part.y * scale;
    const pw = part.length * scale;
    const ph = part.width * scale;
    const [r, g, b] = hexToRgb(part.color);

    // Light fill tinted from part color
    doc.setFillColor(
      Math.round(r * 0.18 + 255 * 0.82),
      Math.round(g * 0.18 + 255 * 0.82),
      Math.round(b * 0.18 + 255 * 0.82)
    );
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.35);
    doc.rect(px, py, pw, ph, 'FD');

    // Edge banding marks (thick orange edge highlight)
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.9);
    if (part.edgeBanding.top) doc.line(px, py, px + pw, py);
    if (part.edgeBanding.bottom) doc.line(px, py + ph, px + pw, py + ph);
    if (part.edgeBanding.left) doc.line(px, py, px, py + ph);
    if (part.edgeBanding.right) doc.line(px + pw, py, px + pw, py + ph);

    if (pw > 14 && ph > 8) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(pw > 28 && ph > 14 ? 7 : 5.5);
      doc.setTextColor(17, 24, 39);
      const label = part.name.length > 18 ? part.name.slice(0, 16) + '…' : part.name;
      doc.text(label, px + pw / 2, py + ph / 2 - 0.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(75, 85, 99);
      doc.text(
        `${part.length}×${part.width}${part.rotated ? ' ↻' : ''}`,
        px + pw / 2,
        py + ph / 2 + 3.2,
        { align: 'center' }
      );
    }
  });
}

export function generateProjectPdfBlob(
  project: CuttingProject,
  result: OptimizationResult,
  settings: CompanySettings
): { blob: Blob; fileName: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const currency = settings.currency || '$';

  // Dark Industrial Header Band
  doc.setFillColor(24, 27, 31);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 34, pageW, 1.5, 'F');

  let textStartX = margin;
  if (settings.logoDataUrl && settings.logoDataUrl.startsWith('data:image/')) {
    try {
      const fmt = settings.logoDataUrl.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(settings.logoDataUrl, fmt, margin, 6, 22, 22);
      textStartX = margin + 26;
    } catch {
      // Skip logo if malformed
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(settings.companyName || 'CutMaster MDF Optimizer', textStartX, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(209, 213, 219);
  const contactParts = [
    settings.contactEmail,
    settings.contactPhone,
    settings.address,
  ].filter(Boolean);
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  ·  ').slice(0, 95), textStartX, 20);
  } else {
    doc.text('MDF Cutting Optimization & Material Cost Report', textStartX, 20);
  }
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, textStartX, 26);

  // Project & Customer Metadata Box
  let curY = 43;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.rect(margin, curY, contentW, 24, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text(project.name || 'Untitled Project', margin + 4, curY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text(
    `Customer: ${project.customerName || 'Workshop Internal'}`,
    margin + 4,
    curY + 13.5
  );
  doc.text(
    `Material: ${project.sheetConfig.materialType} (${project.sheetConfig.length} × ${project.sheetConfig.width} × ${project.sheetConfig.thickness} mm)  ·  Kerf: ${project.sheetConfig.kerf} mm`,
    margin + 4,
    curY + 19.5
  );

  // KPI Summary Grid (4 boxes)
  curY += 30;
  const kpis = [
    { label: 'TOTAL SHEETS', value: `${result.totalSheets} pcs` },
    { label: 'EFFICIENCY', value: `${result.efficiencyPct}%` },
    { label: 'MATERIAL WASTE', value: `${result.wastePct}% (${result.wasteAreaSqM} m²)` },
    { label: 'TOTAL COST', value: `${currency}${result.totalMaterialCost.toFixed(2)}` },
  ];
  const boxW = (contentW - 9) / 4;
  kpis.forEach((k, idx) => {
    const bx = margin + idx * (boxW + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(209, 213, 219);
    doc.rect(bx, curY, boxW, 18, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(k.label, bx + 3, curY + 6);
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(k.value, bx + 3, curY + 13.5);
  });

  // Cost & Waste Breakdown Row
  curY += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text('Cost & Waste Analysis', margin, curY);
  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text(
    `Cost/Sheet: ${currency}${project.sheetConfig.costPerSheet.toFixed(2)}   |   Avg Cost/Part: ${currency}${result.costPerPart.toFixed(2)}   |   Est. Waste Cost: ${currency}${result.estimatedWasteCost.toFixed(2)}   |   Usable Offcuts: ${result.usableOffcutAreaSqM} m² (${currency}${result.usableOffcutValue.toFixed(2)})`,
    margin,
    curY
  );

  // Parts List Table
  curY += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text(`Parts Cut List (${project.parts.length} line items · ${result.totalPartsPlaced} pieces)`, margin, curY);
  curY += 3;

  // Table header
  const colX = [margin, margin + 52, margin + 78, margin + 102, margin + 116, margin + 142];
  doc.setFillColor(31, 41, 55);
  doc.rect(margin, curY, contentW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Part Name', colX[0] + 2, curY + 4.8);
  doc.text('Length', colX[1], curY + 4.8);
  doc.text('Width', colX[2], curY + 4.8);
  doc.text('Qty', colX[3], curY + 4.8);
  doc.text('Edge Banding', colX[4], curY + 4.8);
  doc.text('Notes', colX[5], curY + 4.8);
  curY += 7;

  project.parts.forEach((p, idx) => {
    if (curY > pageH - 22) {
      doc.addPage();
      curY = 18;
    }
    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, curY, contentW, 6.5, 'F');
    }
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, curY + 6.5, margin + contentW, curY + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text((p.name || 'Part').slice(0, 26), colX[0] + 2, curY + 4.5);
    doc.text(`${p.length} mm`, colX[1], curY + 4.5);
    doc.text(`${p.width} mm`, colX[2], curY + 4.5);
    doc.text(`${p.quantity}`, colX[3], curY + 4.5);
    const eb = [
      p.edgeBanding.top ? 'T' : '',
      p.edgeBanding.bottom ? 'B' : '',
      p.edgeBanding.left ? 'L' : '',
      p.edgeBanding.right ? 'R' : '',
    ]
      .filter(Boolean)
      .join(',');
    doc.text(eb || 'None', colX[4], curY + 4.5);
    doc.text((p.notes || '—').slice(0, 22), colX[5], curY + 4.5);
    curY += 6.5;
  });

  // Cutting Layout Diagrams (2 sheets per page)
  if (result.sheets.length > 0) {
    result.sheets.forEach((sheet, idx) => {
      const slotOnPage = idx % 2;
      if (slotOnPage === 0) {
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(17, 24, 39);
        doc.text('Optimized Sheet Cutting Layouts', margin, 16);
      }
      const diagY = slotOnPage === 0 ? 28 : 156;
      drawSheetDiagramOnPdf(doc, sheet, margin, diagY, contentW, 112);
    });
  }

  const cleanName = (project.name || 'cutmaster_report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
  const fileName = `${cleanName}_report_${Date.now()}.pdf`;
  const blob = doc.output('blob');
  return { blob, fileName };
}

export function printPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Fallback: trigger download if iframe print blocked
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cutmaster_report.pdf';
      a.click();
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  document.body.appendChild(iframe);
}
