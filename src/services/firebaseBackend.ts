/**
 * FIREBASE & CLOUDINARY BACKEND SERVICE (Cloud Firestore & Cloudinary Artwork CDN)
 * 
 * Provides production data management, project persistence, and asset storage:
 * - Cloud Firestore: Stores project configurations, layer setups, nesting results, and user defaults.
 * - Cloudinary: Stores high-resolution raster sticker artwork, preventing Firestore 1MB document limit overruns.
 * - Security Rules: Enforces isolated user ownership (/users/{userId}/...) across all Firestore operations.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadToCloudinary } from './cloudinaryService';
import { ArtworkAsset, ContourConfig, MediaConfig, NestingConfig, RegistrationConfig, UnitType } from '../types';

export interface CloudProjectSummary {
  id: string;
  projectName: string;
  unit: UnitType;
  artworkCount: number;
  totalInstances: number;
  mediaDimensions: string;
  updatedAt: Date | null;
  createdAt: Date | null;
}

export interface CloudProjectPayload {
  projectName: string;
  unit: UnitType;
  artworkList: ArtworkAsset[];
  contourConfig: ContourConfig;
  mediaConfig: MediaConfig;
  nestingConfig: NestingConfig;
  registrationConfig: RegistrationConfig;
}

export interface UserProductionSettings {
  defaultUnit?: UnitType;
  defaultCutterPreset?: string;
  defaultMediaPreset?: string;
  defaultSpacingMm?: number;
  defaultContourOffsetMm?: number;
  autoSaveToCloud?: boolean;
}

/**
 * Uploads high-res raster artwork to Cloudinary to optimize Firestore document sizes
 */
export async function uploadArtworkAsset(
  userId: string,
  projectId: string,
  asset: ArtworkAsset
): Promise<ArtworkAsset> {
  // If artwork is SVG or already has a remote http(s) URL, keep lightweight inline
  if (
    !asset.dataUrl ||
    asset.fileType === 'image/svg+xml' ||
    Boolean(asset.svgContent) ||
    asset.dataUrl.startsWith('http://') ||
    asset.dataUrl.startsWith('https://') ||
    asset.dataUrl.startsWith('data:image/svg+xml')
  ) {
    return asset;
  }

  // If it's a large raster dataUrl (PNG/JPEG)
  if (asset.dataUrl.startsWith('data:image/')) {
    try {
      const safeFilename = `${asset.id}_${asset.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const folder = `stickercut_pro/users/${userId}/projects/${projectId}`;

      const { secure_url, public_id } = await uploadToCloudinary(asset.dataUrl, {
        folder,
        filename: safeFilename,
        tags: ['stickercut_artwork', userId, projectId],
      });

      return {
        ...asset,
        dataUrl: secure_url, // Replace bulky base64 with Cloudinary CDN URL
        cloudinaryUrl: secure_url,
        cloudinaryPublicId: public_id,
      };
    } catch (uploadErr) {
      console.warn(`Cloudinary upload failed for ${asset.filename}, keeping inline dataUrl:`, uploadErr);
      return asset;
    }
  }

  return asset;
}

/**
 * Saves a production sticker project to Cloud Firestore (and uploads assets to Cloud Storage)
 */
export async function saveProjectToFirestore(
  userId: string,
  projectData: CloudProjectPayload,
  existingProjectId?: string
): Promise<{ projectId: string; success: boolean }> {
  if (!userId) {
    throw new Error('User must be authenticated to save projects to Cloud Firestore');
  }

  const projectId = existingProjectId || `proj_${Date.now()}`;

  // 1. Upload any large artwork to Cloud Storage if needed
  const processedArtworkList: ArtworkAsset[] = [];
  for (const asset of projectData.artworkList) {
    const processed = await uploadArtworkAsset(userId, projectId, asset);
    processedArtworkList.push(processed);
  }

  // 2. Prepare Firestore document payload
  const projectDocRef = doc(db, 'users', userId, 'projects', projectId);

  const totalInstances = processedArtworkList.reduce((acc, a) => acc + (a.quantity || 1), 0);
  const mediaDims = `${projectData.mediaConfig.widthMm} x ${projectData.mediaConfig.heightMm} mm`;

  const docPayload = {
    id: projectId,
    userId,
    projectName: projectData.projectName.trim() || 'Untitled Sticker Project',
    unit: projectData.unit || 'mm',
    artworkList: processedArtworkList,
    contourConfig: projectData.contourConfig,
    mediaConfig: projectData.mediaConfig,
    nestingConfig: projectData.nestingConfig,
    registrationConfig: projectData.registrationConfig,
    summary: {
      artworkCount: processedArtworkList.length,
      totalInstances,
      mediaDimensions: mediaDims,
    },
    updatedAt: serverTimestamp(),
    ...(existingProjectId ? {} : { createdAt: serverTimestamp() }),
  };

  await setDoc(projectDocRef, docPayload, { merge: true });

  return { projectId, success: true };
}

/**
 * Lists all projects owned by the user in Cloud Firestore
 */
export async function listUserCloudProjects(userId: string): Promise<CloudProjectSummary[]> {
  if (!userId) return [];

  const projectsColRef = collection(db, 'users', userId, 'projects');
  const q = query(projectsColRef, orderBy('updatedAt', 'desc'));

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      const updatedTimestamp = data.updatedAt as Timestamp | undefined;
      const createdTimestamp = data.createdAt as Timestamp | undefined;

      return {
        id: d.id,
        projectName: data.projectName || 'Untitled Project',
        unit: data.unit || 'mm',
        artworkCount: data.summary?.artworkCount ?? data.artworkList?.length ?? 0,
        totalInstances: data.summary?.totalInstances ?? 0,
        mediaDimensions: data.summary?.mediaDimensions ?? 'Standard',
        updatedAt: updatedTimestamp ? updatedTimestamp.toDate() : null,
        createdAt: createdTimestamp ? createdTimestamp.toDate() : null,
      };
    });
  } catch (err) {
    console.error('Failed to list user cloud projects from Firestore:', err);
    throw err;
  }
}

/**
 * Loads a full project payload from Cloud Firestore
 */
export async function loadProjectFromFirestore(
  userId: string,
  projectId: string
): Promise<CloudProjectPayload> {
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required to load from Cloud Firestore');
  }

  const projectDocRef = doc(db, 'users', userId, 'projects', projectId);
  const snap = await getDoc(projectDocRef);

  if (!snap.exists()) {
    throw new Error('Project document not found in Cloud Firestore');
  }

  const data = snap.data();
  return {
    projectName: data.projectName,
    unit: data.unit,
    artworkList: data.artworkList || [],
    contourConfig: data.contourConfig,
    mediaConfig: data.mediaConfig,
    nestingConfig: data.nestingConfig,
    registrationConfig: data.registrationConfig,
  };
}

/**
 * Deletes a project from Cloud Firestore
 */
export async function deleteProjectFromFirestore(userId: string, projectId: string): Promise<void> {
  if (!userId || !projectId) return;
  const projectDocRef = doc(db, 'users', userId, 'projects', projectId);
  await deleteDoc(projectDocRef);
}

/**
 * Saves user production defaults and preferences in Cloud Firestore
 */
export async function saveUserProductionSettings(
  userId: string,
  settings: UserProductionSettings
): Promise<void> {
  if (!userId) return;
  const settingsDocRef = doc(db, 'users', userId, 'settings', 'productionDefaults');
  await setDoc(
    settingsDocRef,
    {
      userId,
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Retrieves user production defaults and preferences from Cloud Firestore
 */
export async function fetchUserProductionSettings(
  userId: string
): Promise<UserProductionSettings | null> {
  if (!userId) return null;
  const settingsDocRef = doc(db, 'users', userId, 'settings', 'productionDefaults');
  const snap = await getDoc(settingsDocRef);
  if (!snap.exists()) return null;
  return snap.data() as UserProductionSettings;
}
