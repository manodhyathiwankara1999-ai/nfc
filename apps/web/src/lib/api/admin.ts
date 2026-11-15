import type { CardData, CardOffice, CardProduct, CardProfileData } from '@nfc/shared';
import { apiRequest } from './client';

export interface AdminPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminOverview {
  users: number;
  cards: number;
  activeCards: number;
  inactiveCards: number;
  deletedCards: number;
  products: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  cardCount: number;
}

export interface AdminAuditLog {
  id: string;
  actorId: string | null;
  cardId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; email: string; name: string | null } | null;
  card: { id: string; slug: string } | null;
}

export interface AdminCardUpdate {
  card?: CardData;
  profile?: CardProfileData;
  office?: CardOffice;
  products?: CardProduct[];
}

export function getAdminOverview(): Promise<AdminOverview> {
  return apiRequest('/admin/overview');
}

export function getAdminCards(params: {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminPage<import('./cards').UserCard>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return apiRequest(`/admin/cards?${search}`);
}

export function getAdminUsers(params: {
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminPage<AdminUser>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return apiRequest(`/admin/users?${search}`);
}

export function getAdminAuditLogs(page = 1): Promise<AdminPage<AdminAuditLog>> {
  return apiRequest(`/admin/audit-logs?page=${page}&pageSize=50`);
}

export function createAdminCard(input: {
  ownerEmail: string;
  purpose: CardData['purpose'];
  customPurpose?: string;
  slug?: string;
}): Promise<import('./cards').UserCard> {
  return apiRequest('/admin/cards', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminCard(
  cardId: string,
  input: AdminCardUpdate,
): Promise<import('./cards').UserCard> {
  return apiRequest(`/admin/cards/${encodeURIComponent(cardId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setAdminCardStatus(
  cardId: string,
  action: 'activate' | 'deactivate' | 'delete' | 'restore',
): Promise<{ id: string; status: string }> {
  return apiRequest(`/admin/cards/${encodeURIComponent(cardId)}/${action}`, { method: 'POST' });
}
