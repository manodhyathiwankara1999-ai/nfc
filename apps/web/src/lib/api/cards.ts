import type { CardData, CardOffice, CardProduct, CardProfileData } from '@nfc/shared';
import { apiRequest } from './client';

export type CardStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOST' | 'DELETED';
export type CardUploadKind = 'AVATAR' | 'COVER' | 'GALLERY' | 'PRODUCT';

export interface CardProductItem extends Omit<CardProduct, 'sortOrder'> {
  id: string;
  sortOrder: number;
}

export interface UserCard {
  id: string;
  ownerId: string | null;
  slug: string;
  status: CardStatus;
  purpose: CardData['purpose'];
  customPurpose: string | null;
  createdBy: 'OWNER' | 'SUPER_ADMIN';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  profile: CardProfileData;
  office: CardOffice | null;
  products: CardProductItem[];
  owner: { id: string; email: string; name: string | null } | null;
  hasSavedProfile: boolean;
}

export function getMyCards(): Promise<UserCard[]> {
  return apiRequest<UserCard[]>('/cards');
}

export function getMyCard(cardId: string): Promise<UserCard> {
  return apiRequest<UserCard>(`/cards/${encodeURIComponent(cardId)}`);
}

export function updateCardDetails(cardId: string, data: CardData): Promise<UserCard> {
  return apiRequest<UserCard>(`/cards/${encodeURIComponent(cardId)}/details`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function updateCardProfile(cardId: string, profile: CardProfileData): Promise<UserCard> {
  return apiRequest<UserCard>(`/cards/${encodeURIComponent(cardId)}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(profile),
  });
}

export function updateCardOffice(cardId: string, office: CardOffice): Promise<UserCard> {
  return apiRequest<UserCard>(`/cards/${encodeURIComponent(cardId)}/office`, {
    method: 'PATCH',
    body: JSON.stringify(office),
  });
}

export function addCardProduct(
  cardId: string,
  product: Omit<CardProduct, 'sortOrder'>,
): Promise<UserCard> {
  return apiRequest<UserCard>(`/cards/${encodeURIComponent(cardId)}/products`, {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

export function updateCardProduct(
  cardId: string,
  productId: string,
  patch: Partial<Omit<CardProduct, 'sortOrder'>>,
): Promise<UserCard> {
  return apiRequest<UserCard>(
    `/cards/${encodeURIComponent(cardId)}/products/${encodeURIComponent(productId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}

export function removeCardProduct(cardId: string, productId: string): Promise<UserCard> {
  return apiRequest<UserCard>(
    `/cards/${encodeURIComponent(cardId)}/products/${encodeURIComponent(productId)}`,
    { method: 'DELETE' },
  );
}

export function reorderCardProducts(cardId: string, productIds: string[]): Promise<UserCard> {
  return apiRequest<UserCard>(`/cards/${encodeURIComponent(cardId)}/products/reorder`, {
    method: 'PATCH',
    body: JSON.stringify(productIds),
  });
}

export function setCardStatus(
  cardId: string,
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED',
): Promise<{ id: string; status: CardStatus }> {
  const action = status === 'DELETED' ? '' : status === 'ACTIVE' ? 'activate' : 'deactivate';
  return apiRequest<{ id: string; status: CardStatus }>(
    `/cards/${encodeURIComponent(cardId)}${action ? `/${action}` : ''}`,
    { method: status === 'DELETED' ? 'DELETE' : 'POST' },
  );
}

export async function uploadCardImage(
  cardId: string,
  kind: CardUploadKind,
  file: File,
  onProgress: (progress: number) => void = () => undefined,
): Promise<string> {
  const presigned = await apiRequest<{
    uploadUrl: string;
    objectKey: string;
    publicUrl: string;
    token: string;
    headers: { 'Content-Type': string };
  }>(`/cards/${encodeURIComponent(cardId)}/uploads/presign`, {
    method: 'POST',
    body: JSON.stringify({ kind, contentType: file.type, size: file.size }),
  });
  await putWithProgress(presigned.uploadUrl, file, presigned.headers['Content-Type'], onProgress);
  const confirmed = await apiRequest<{ objectKey: string; url: string }>(
    `/cards/${encodeURIComponent(cardId)}/uploads/confirm`,
    {
      method: 'POST',
      body: JSON.stringify({
        objectKey: presigned.objectKey,
        contentType: file.type,
        size: file.size,
        token: presigned.token,
      }),
    },
  );
  return confirmed.url;
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
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
