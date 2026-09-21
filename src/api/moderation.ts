import { request } from './client';
import type { AdminReportsPage, BlockedUser, ModerationAction, ReportInput } from './types';

// Blocchi, segnalazioni e area di moderazione (modulo M3.3).

export async function listBlocks(): Promise<BlockedUser[]> {
  const { items } = await request<{ items: BlockedUser[] }>('/api/v1/me/blocks');
  return items;
}

/** Nessuno dei due potrà più scrivere all'altro né trovarlo nelle ricerche. */
export function blockUser(userId: string): Promise<void> {
  return request<void>(`/api/v1/me/blocks/${encodeURIComponent(userId)}`, { method: 'PUT' });
}

export function unblockUser(userId: string): Promise<void> {
  return request<void>(`/api/v1/me/blocks/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export function sendReport(input: ReportInput): Promise<{ id: number }> {
  return request<{ id: number }>('/api/v1/reports', { method: 'POST', body: input });
}

export function listAdminReports(status: 'open' | 'closed', cursor = ''): Promise<AdminReportsPage> {
  const params = new URLSearchParams({ status });
  if (cursor) params.set('cursor', cursor);
  return request<AdminReportsPage>(`/api/v1/admin/reports?${params}`);
}

export function resolveReport(id: number, action: ModerationAction, note: string): Promise<void> {
  return request<void>(`/api/v1/admin/reports/${id}/resolve`, { method: 'POST', body: { action, note } });
}

export function unsuspendUser(userId: string): Promise<void> {
  return request<void>(`/api/v1/admin/users/${encodeURIComponent(userId)}/unsuspend`, { method: 'POST' });
}

export function restoreListing(listingId: number): Promise<void> {
  return request<void>(`/api/v1/admin/listings/${listingId}/restore`, { method: 'POST' });
}
