import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type {
  CompanySettings,
  CuttingProject,
  PartInput,
  ProjectReport,
  SharedProjectSnapshot,
  UserProfile,
} from '../types/cutmaster';
import { db, handleFirestoreError, OperationType, storage } from './firebase';

function tsToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || `id_${Date.now()}`;
}

export function sanitizePartsForFirestore(parts: PartInput[]): PartInput[] {
  return parts.slice(0, 300).map((p) => ({
    id: String(p.id || '').slice(0, 64),
    name: String(p.name || 'Part').slice(0, 100),
    length: Math.max(1, Math.min(10000, Number(p.length) || 1)),
    width: Math.max(1, Math.min(10000, Number(p.width) || 1)),
    quantity: Math.max(1, Math.min(5000, Math.floor(Number(p.quantity) || 1))),
    allowRotation: Boolean(p.allowRotation),
    edgeBanding: {
      top: Boolean(p.edgeBanding?.top),
      bottom: Boolean(p.edgeBanding?.bottom),
      left: Boolean(p.edgeBanding?.left),
      right: Boolean(p.edgeBanding?.right),
    },
    notes: String(p.notes || '').slice(0, 200),
    color: String(p.color || '#EA580C').slice(0, 24),
  }));
}

export async function upsertUserProfile(profile: {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
}): Promise<void> {
  const path = `users/${profile.uid}`;
  const docRef = doc(db, 'users', profile.uid);
  try {
    const snap = await getDoc(docRef);
    const payload: Record<string, unknown> = {
      uid: profile.uid,
      displayName: (profile.displayName || 'Workshop User').slice(0, 100),
      email: (profile.email || 'user@example.com').slice(0, 254),
      updatedAt: serverTimestamp(),
    };
    if (profile.photoURL && profile.photoURL.length <= 500) {
      payload.photoURL = profile.photoURL;
    }
    if (!snap.exists()) {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      const updatePayload: Record<string, unknown> = {
        displayName: payload.displayName,
        updatedAt: serverTimestamp(),
      };
      if (payload.photoURL) updatePayload.photoURL = payload.photoURL;
      await updateDoc(docRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: d.uid,
      displayName: d.displayName,
      email: d.email,
      photoURL: d.photoURL,
      createdAt: tsToIso(d.createdAt),
      updatedAt: tsToIso(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  const path = `users/${settings.ownerId}/company/settings`;
  const docRef = doc(db, 'users', settings.ownerId, 'company', 'settings');
  try {
    const snap = await getDoc(docRef);
    const payload: Record<string, unknown> = {
      ownerId: settings.ownerId,
      companyName: (settings.companyName || '').slice(0, 120),
      contactEmail: (settings.contactEmail || '').slice(0, 254),
      contactPhone: (settings.contactPhone || '').slice(0, 40),
      address: (settings.address || '').slice(0, 300),
      currency: (settings.currency || '$').slice(0, 8),
      defaultSheetLength: Math.max(100, Math.min(10000, Number(settings.defaultSheetLength) || 2440)),
      defaultSheetWidth: Math.max(100, Math.min(10000, Number(settings.defaultSheetWidth) || 1220)),
      defaultThickness: Math.max(1, Math.min(200, Number(settings.defaultThickness) || 18)),
      defaultCostPerSheet: Math.max(0, Math.min(1000000, Number(settings.defaultCostPerSheet) || 48)),
      defaultMaterialType: (settings.defaultMaterialType || 'Standard Raw MDF').slice(0, 80),
      defaultKerf: Math.max(0, Math.min(50, Number(settings.defaultKerf) || 3.2)),
      theme: settings.theme === 'dark' ? 'dark' : 'light',
      updatedAt: serverTimestamp(),
    };
    if (settings.logoDataUrl && settings.logoDataUrl.length <= 200000) {
      payload.logoDataUrl = settings.logoDataUrl;
    }

    if (!snap.exists()) {
      await setDoc(docRef, payload);
    } else {
      const updatePayload = { ...payload };
      delete updatePayload.ownerId;
      await updateDoc(docRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchCompanySettings(uid: string): Promise<CompanySettings | null> {
  const path = `users/${uid}/company/settings`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'company', 'settings'));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      ownerId: d.ownerId,
      companyName: d.companyName || '',
      logoDataUrl: d.logoDataUrl,
      contactEmail: d.contactEmail || '',
      contactPhone: d.contactPhone || '',
      address: d.address || '',
      currency: d.currency || '$',
      defaultSheetLength: Number(d.defaultSheetLength) || 2440,
      defaultSheetWidth: Number(d.defaultSheetWidth) || 1220,
      defaultThickness: Number(d.defaultThickness) || 18,
      defaultCostPerSheet: Number(d.defaultCostPerSheet) || 48,
      defaultMaterialType: d.defaultMaterialType || 'Standard Raw MDF',
      defaultKerf: Number(d.defaultKerf) || 3.2,
      theme: d.theme === 'dark' ? 'dark' : 'light',
      updatedAt: tsToIso(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeUserProjects(
  uid: string,
  onData: (projects: CuttingProject[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, 'projects'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CuttingProject[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: d.ownerId,
          name: d.name,
          customerName: d.customerName || '',
          notes: d.notes || '',
          status: d.status || 'draft',
          sheetConfig: d.sheetConfig,
          parts: Array.isArray(d.parts) ? d.parts : [],
          summary: d.summary,
          shareId: d.shareId,
          createdAt: tsToIso(d.createdAt),
          updatedAt: tsToIso(d.updatedAt),
        };
      });
      items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, 'projects');
    }
  );
}

export async function saveProjectToCloud(project: CuttingProject): Promise<void> {
  const pid = sanitizeId(project.id);
  const path = `projects/${pid}`;
  const docRef = doc(db, 'projects', pid);
  try {
    const snap = await getDoc(docRef);
    const cleanSheetConfig = {
      length: Math.max(100, Math.min(10000, Number(project.sheetConfig.length) || 2440)),
      width: Math.max(100, Math.min(10000, Number(project.sheetConfig.width) || 1220)),
      thickness: Math.max(1, Math.min(200, Number(project.sheetConfig.thickness) || 18)),
      costPerSheet: Math.max(0, Math.min(1000000, Number(project.sheetConfig.costPerSheet) || 0)),
      materialType: String(project.sheetConfig.materialType || 'Standard Raw MDF').slice(0, 80),
      kerf: Math.max(0, Math.min(50, Number(project.sheetConfig.kerf) || 0)),
      trimMargin: Math.max(0, Math.min(200, Number(project.sheetConfig.trimMargin) || 0)),
      allowRotation: Boolean(project.sheetConfig.allowRotation),
    };
    const cleanSummary = {
      totalSheets: Math.max(0, Number(project.summary.totalSheets) || 0),
      efficiencyPct: Math.max(0, Math.min(100, Number(project.summary.efficiencyPct) || 0)),
      wastePct: Math.max(0, Math.min(100, Number(project.summary.wastePct) || 0)),
      totalMaterialCost: Math.max(0, Number(project.summary.totalMaterialCost) || 0),
      usedAreaSqM: Math.max(0, Number(project.summary.usedAreaSqM) || 0),
      wasteAreaSqM: Math.max(0, Number(project.summary.wasteAreaSqM) || 0),
      totalPartsPlaced: Math.max(0, Number(project.summary.totalPartsPlaced) || 0),
    };
    const cleanParts = sanitizePartsForFirestore(project.parts);

    if (!snap.exists()) {
      const createPayload: Record<string, unknown> = {
        id: pid,
        ownerId: project.ownerId,
        name: (project.name || 'Untitled Project').slice(0, 120),
        customerName: (project.customerName || '').slice(0, 120),
        notes: (project.notes || '').slice(0, 2000),
        status: project.status || 'optimized',
        sheetConfig: cleanSheetConfig,
        parts: cleanParts,
        summary: cleanSummary,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (project.shareId) {
        createPayload.shareId = sanitizeId(project.shareId).slice(0, 64);
      }
      await setDoc(docRef, createPayload);
    } else {
      const updatePayload: Record<string, unknown> = {
        name: (project.name || 'Untitled Project').slice(0, 120),
        customerName: (project.customerName || '').slice(0, 120),
        notes: (project.notes || '').slice(0, 2000),
        status: project.status || 'optimized',
        sheetConfig: cleanSheetConfig,
        parts: cleanParts,
        summary: cleanSummary,
        updatedAt: serverTimestamp(),
      };
      if (project.shareId) {
        updatePayload.shareId = sanitizeId(project.shareId).slice(0, 64);
      }
      await updateDoc(docRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProjectFromCloud(projectId: string): Promise<void> {
  const pid = sanitizeId(projectId);
  const path = `projects/${pid}`;
  try {
    await deleteDoc(doc(db, 'projects', pid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function publishShareSnapshot(
  project: CuttingProject,
  companyName: string
): Promise<string> {
  const shareId = project.shareId || `share_${sanitizeId(project.id)}_${Date.now().toString(36)}`;
  const path = `sharedProjects/${shareId}`;
  const docRef = doc(db, 'sharedProjects', shareId);
  try {
    const snap = await getDoc(docRef);
    const baseData = {
      shareId,
      projectId: sanitizeId(project.id),
      ownerId: project.ownerId,
      name: (project.name || 'Shared Cut Plan').slice(0, 120),
      companyName: (companyName || '').slice(0, 120),
      sheetConfig: project.sheetConfig,
      parts: sanitizePartsForFirestore(project.parts),
      summary: project.summary,
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(docRef, {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        name: baseData.name,
        companyName: baseData.companyName,
        sheetConfig: baseData.sheetConfig,
        parts: baseData.parts,
        summary: baseData.summary,
        updatedAt: serverTimestamp(),
      });
    }

    // Store shareId reference on parent project
    await updateDoc(doc(db, 'projects', sanitizeId(project.id)), {
      shareId,
      updatedAt: serverTimestamp(),
    });

    return shareId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchSharedProject(shareId: string): Promise<SharedProjectSnapshot | null> {
  const sid = sanitizeId(shareId);
  const path = `sharedProjects/${sid}`;
  try {
    const snap = await getDoc(doc(db, 'sharedProjects', sid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      shareId: d.shareId,
      projectId: d.projectId,
      ownerId: d.ownerId,
      name: d.name,
      companyName: d.companyName,
      sheetConfig: d.sheetConfig,
      parts: Array.isArray(d.parts) ? d.parts : [],
      summary: d.summary,
      createdAt: tsToIso(d.createdAt),
      updatedAt: tsToIso(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveReportToCloud(
  project: CuttingProject,
  fileName: string,
  pdfBlob: Blob
): Promise<ProjectReport> {
  const pid = sanitizeId(project.id);
  const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const storagePath = `reports/${project.ownerId}/${pid}/${fileName}`;

  let downloadUrl: string | undefined;
  let uploadedPath: string | undefined;

  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, pdfBlob, { contentType: 'application/pdf' });
    downloadUrl = await getDownloadURL(storageRef);
    uploadedPath = storagePath;
  } catch {
    // Storage bucket might not have CORS/rules activated yet; still record report metadata in Firestore
  }

  const path = `projects/${pid}/reports/${reportId}`;
  try {
    const payload: Record<string, unknown> = {
      id: reportId,
      projectId: pid,
      ownerId: project.ownerId,
      fileName: fileName.slice(0, 160),
      totalSheets: Number(project.summary.totalSheets) || 0,
      efficiencyPct: Number(project.summary.efficiencyPct) || 0,
      totalCost: Number(project.summary.totalMaterialCost) || 0,
      createdAt: serverTimestamp(),
    };
    if (uploadedPath) payload.storagePath = uploadedPath.slice(0, 300);
    if (downloadUrl) payload.downloadUrl = downloadUrl.slice(0, 1000);

    await setDoc(doc(db, 'projects', pid, 'reports', reportId), payload);

    return {
      id: reportId,
      projectId: pid,
      ownerId: project.ownerId,
      fileName,
      storagePath: uploadedPath,
      downloadUrl,
      totalSheets: project.summary.totalSheets,
      efficiencyPct: project.summary.efficiencyPct,
      totalCost: project.summary.totalMaterialCost,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchProjectReports(
  projectId: string,
  ownerId: string
): Promise<ProjectReport[]> {
  const pid = sanitizeId(projectId);
  const path = `projects/${pid}/reports`;
  try {
    const q = query(
      collection(db, 'projects', pid, 'reports'),
      where('ownerId', '==', ownerId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((dSnap) => {
        const d = dSnap.data();
        return {
          id: dSnap.id,
          projectId: d.projectId,
          ownerId: d.ownerId,
          fileName: d.fileName,
          storagePath: d.storagePath,
          downloadUrl: d.downloadUrl,
          totalSheets: Number(d.totalSheets) || 0,
          efficiencyPct: Number(d.efficiencyPct) || 0,
          totalCost: Number(d.totalCost) || 0,
          createdAt: tsToIso(d.createdAt),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
