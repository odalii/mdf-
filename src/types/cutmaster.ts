export interface EdgeBanding {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface PartInput {
  id: string;
  name: string;
  length: number; // mm
  width: number;  // mm
  quantity: number;
  allowRotation: boolean;
  edgeBanding: EdgeBanding;
  notes: string;
  color?: string;
}

export interface SheetConfig {
  length: number;      // mm (X axis)
  width: number;       // mm (Y axis)
  thickness: number;   // mm
  costPerSheet: number;
  materialType: string;
  kerf: number;        // mm
  trimMargin: number;  // mm outer trim
  allowRotation: boolean;
}

export interface PlacedPart {
  instanceId: string;
  partId: string;
  name: string;
  x: number;
  y: number;
  length: number;      // placed width along sheet X
  width: number;       // placed height along sheet Y
  origLength: number;
  origWidth: number;
  rotated: boolean;
  color: string;
  edgeBanding: EdgeBanding;
  notes: string;
}

export interface OffcutRect {
  id: string;
  x: number;
  y: number;
  length: number;
  width: number;
  areaSqM: number;
  usable: boolean;
}

export interface CutLine {
  id: string;
  orientation: 'V' | 'H';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lengthMm: number;
}

export interface OptimizedSheet {
  sheetIndex: number;
  sheetLength: number;
  sheetWidth: number;
  placedParts: PlacedPart[];
  offcuts: OffcutRect[];
  cutLines: CutLine[];
  usedAreaMm2: number;
  totalAreaMm2: number;
  efficiencyPct: number;
  wastePct: number;
  usableOffcutAreaSqM: number;
}

export interface OversizedPartError {
  partId: string;
  name: string;
  length: number;
  width: number;
  reason: string;
}

export interface OptimizationResult {
  sheets: OptimizedSheet[];
  totalSheets: number;
  totalPartsRequested: number;
  totalPartsPlaced: number;
  usedAreaSqM: number;
  totalSheetAreaSqM: number;
  wasteAreaSqM: number;
  usableOffcutAreaSqM: number;
  efficiencyPct: number;
  wastePct: number;
  totalMaterialCost: number;
  costPerPart: number;
  estimatedWasteCost: number;
  usableOffcutValue: number;
  oversizedParts: OversizedPartError[];
  algorithmUsed: string;
}

export interface ProjectSummary {
  totalSheets: number;
  efficiencyPct: number;
  wastePct: number;
  totalMaterialCost: number;
  usedAreaSqM: number;
  wasteAreaSqM: number;
  totalPartsPlaced?: number;
}

export type ProjectStatus = 'draft' | 'optimized' | 'archived';

export interface CuttingProject {
  id: string;
  ownerId: string;
  name: string;
  customerName: string;
  notes: string;
  status: ProjectStatus;
  sheetConfig: SheetConfig;
  parts: PartInput[];
  summary: ProjectSummary;
  shareId?: string;
  createdAt: string; // ISO string in app state; Firestore uses Timestamp
  updatedAt: string;
  isLocalOnly?: boolean;
}

export interface CompanySettings {
  ownerId: string;
  companyName: string;
  logoDataUrl?: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  currency: string;
  defaultSheetLength: number;
  defaultSheetWidth: number;
  defaultThickness: number;
  defaultCostPerSheet: number;
  defaultMaterialType: string;
  defaultKerf: number;
  theme: 'light' | 'dark';
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectReport {
  id: string;
  projectId: string;
  ownerId: string;
  fileName: string;
  storagePath?: string;
  downloadUrl?: string;
  totalSheets: number;
  efficiencyPct: number;
  totalCost: number;
  createdAt: string;
}

export interface SharedProjectSnapshot {
  shareId: string;
  projectId: string;
  ownerId: string;
  name: string;
  companyName?: string;
  sheetConfig: SheetConfig;
  parts: PartInput[];
  summary: ProjectSummary;
  createdAt: string;
  updatedAt: string;
}

export interface SheetPreset {
  id: string;
  label: string;
  length: number;
  width: number;
  thickness: number;
  materialType: string;
  costPerSheet: number;
}
