/**
 * CLOUDINARY MEDIA SERVICE
 * 
 * Manages high-resolution sticker artwork uploads to Cloudinary:
 * - Direct unsigned client upload architecture (no exposed API secret)
 * - Offloads bulky raster payloads from Cloud Firestore to preserve the 1MB document limit
 * - Preserves vector SVGs and existing remote CDN URLs
 */

export interface CloudinaryUploadResponse {
  asset_id: string;
  public_id: string;
  version: number;
  version_id?: string;
  signature?: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags?: string[];
  bytes: number;
  type: string;
  etag?: string;
  placeholder?: boolean;
  url: string;
  secure_url: string;
  folder?: string;
  original_filename?: string;
}

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch {
    // Ignore import.meta access errors
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch {
    // Ignore process.env access errors
  }
  return undefined;
};

// Default configuration for StickerCut PRO
export const CLOUDINARY_CONFIG: CloudinaryConfig = {
  cloudName: getEnvVar('VITE_CLOUDINARY_CLOUD_NAME') || 'imx5euju',
  uploadPreset: getEnvVar('VITE_CLOUDINARY_UPLOAD_PRESET') || 'Artwork Stickers',
};

/**
 * Helper to convert data URL to Blob for HTTP multipart upload
 */
export function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    return { blob: new Blob([dataUrl], { type: 'application/octet-stream' }), mimeType: 'application/octet-stream' };
  }

  const header = dataUrl.slice(0, commaIdx);
  const data = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/data:(.*?)(;|$)/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

  if (header.includes(';base64')) {
    const byteString = atob(data);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    return { blob: new Blob([uint8Array], { type: mimeType }), mimeType };
  } else {
    const decoded = decodeURIComponent(data);
    return { blob: new Blob([decoded], { type: mimeType }), mimeType };
  }
}

/**
 * Uploads an image (Blob, File, or base64 data URL) directly to Cloudinary using an unsigned upload preset
 */
export async function uploadToCloudinary(
  fileInput: Blob | File | string,
  options?: {
    folder?: string;
    filename?: string;
    tags?: string[];
    config?: Partial<CloudinaryConfig>;
  }
): Promise<{ secure_url: string; public_id: string }> {
  const cloudName = options?.config?.cloudName || CLOUDINARY_CONFIG.cloudName;
  const uploadPreset = options?.config?.uploadPreset || CLOUDINARY_CONFIG.uploadPreset;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary cloudName and uploadPreset must be configured.');
  }

  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`;

  const formData = new FormData();
  formData.append('upload_preset', uploadPreset);

  if (options?.folder) {
    formData.append('folder', options.folder);
  }

  if (options?.tags && options.tags.length > 0) {
    formData.append('tags', options.tags.join(','));
  }

  if (typeof fileInput === 'string') {
    if (fileInput.startsWith('data:')) {
      const { blob } = dataUrlToBlob(fileInput);
      formData.append('file', blob, options?.filename || 'artwork.png');
    } else {
      // Remote URL or string
      formData.append('file', fileInput);
    }
  } else {
    formData.append('file', fileInput, options?.filename || 'artwork.png');
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedMessage = errText;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error && errJson.error.message) {
        parsedMessage = errJson.error.message;
      }
    } catch {
      // Keep raw text
    }
    throw new Error(`Cloudinary upload failed (${response.status}): ${parsedMessage}`);
  }

  const result: CloudinaryUploadResponse = await response.json();
  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
  };
}
