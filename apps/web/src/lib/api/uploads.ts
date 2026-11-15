import { apiRequest } from './client';

export type UploadKind = 'AVATAR' | 'COVER' | 'GALLERY' | 'LOGO';

interface PresignResponse {
  assetId: string;
  uploadUrl: string;
  expiresIn: number;
  headers: { 'Content-Type': string };
}

export interface GalleryEntry {
  id: string;
  url: string;
  altText: string | null;
  caption: string | null;
  position: number;
}

export async function uploadImage(
  file: File,
  kind: UploadKind,
  onProgress: (progress: number) => void,
): Promise<{ assetId: string; url: string }> {
  const presigned = await apiRequest<PresignResponse>('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ kind, contentType: file.type, size: file.size }),
  });
  await putWithProgress(presigned.uploadUrl, file, presigned.headers['Content-Type'], onProgress);
  return apiRequest('/uploads/confirm', {
    method: 'POST',
    body: JSON.stringify({ assetId: presigned.assetId }),
  });
}

export function deleteCurrentAsset(kind: UploadKind): Promise<{ deleted: boolean }> {
  return apiRequest(`/uploads/current/${kind}`, { method: 'DELETE' });
}

export function getGallery(): Promise<GalleryEntry[]> {
  return apiRequest('/gallery');
}

export function updateGalleryEntry(
  imageId: string,
  patch: { caption?: string | null; altText?: string | null; position?: number },
): Promise<GalleryEntry[]> {
  return apiRequest(`/gallery/${imageId}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteGalleryEntry(imageId: string): Promise<{ deleted: boolean }> {
  return apiRequest(`/gallery/${imageId}`, { method: 'DELETE' });
}

export function getSocialLinks() {
  return apiRequest<
    Array<{ id: string; platform: string; label: string; url: string; position: number }>
  >('/social-links');
}

export function replaceSocialLinks(
  links: Array<{ platform: string; label: string; url: string; position: number }>,
) {
  return apiRequest('/social-links', { method: 'PUT', body: JSON.stringify(links) });
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (value: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Image upload failed (${request.status}).`));
    };
    request.onerror = () => reject(new Error('Image upload could not reach Cloudflare R2.'));
    request.onabort = () => reject(new Error('Image upload was cancelled.'));
    request.send(file);
  });
}
