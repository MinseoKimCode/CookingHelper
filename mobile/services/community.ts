import { request } from './api';
import type { Post } from '../types';

export interface ReportRow {
  id: string;
  kind: string;
  target: string;
  comment: string;
  reason: string;
  detail: string;
  createdAt: string;
}
const path = (id: string, comment?: string) =>
  `/api/community/posts/${encodeURIComponent(id)}${comment ? `/comments/${encodeURIComponent(comment)}` : ''}`;
export const community = {
  edit: (
    id: string,
    ownerToken: string,
    viewer: string,
    content: string,
    title?: string,
    comment?: string,
  ) => request<Post>(`${path(id, comment)}/edit`, { ownerToken, viewer, content, title }),
  remove: (id: string, ownerToken: string, viewer: string, comment?: string) =>
    request<Post | { deleted: boolean }>(`${path(id, comment)}/delete`, { ownerToken, viewer }),
  report: (id: string, viewer: string, reason: string, detail: string, comment?: string) =>
    request(`${path(id, comment)}/reports`, { viewer, reason, detail }),
  reports: (key: string) =>
    request<{ reports: ReportRow[] }>('/api/admin/reports', undefined, undefined, {
      'X-Admin-Key': key,
    }),
  resolve: (key: string, id: string, action: 'dismiss' | 'remove') =>
    request(`/api/admin/reports/${encodeURIComponent(id)}/resolve`, { action }, undefined, {
      'X-Admin-Key': key,
    }),
};
