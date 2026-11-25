import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Post, Recommendation, Settings, Filter, Cuisine } from '../types';

// A physical phone must address the PC's LAN IP, never the phone's localhost.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const configured = process.env.EXPO_PUBLIC_API_URL;
const webOrigin = Platform.OS === 'web' && typeof window !== 'undefined' ? (__DEV__ ? window.location.protocol + '//' + window.location.hostname + ':3000' : window.location.origin) : undefined;
export const API_URL = (configured || webOrigin || (devHost ? `http://${devHost}:3000` : Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000')).replace(/\/$/, '');
export const assetUrl = (url?: string | null) => !url ? undefined : /^https?:\/\//.test(url) ? url : `${API_URL}${url}`;

export async function request<T>(path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 330000); // Generation + independent review can each take 150s.
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `요청에 실패했어요 (${response.status}).`);
    return result as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('요청을 중단했거나 응답 시간이 초과됐어요.');
    if (error instanceof TypeError) throw new Error('서버에 연결할 수 없어요. API 주소와 Wi-Fi 연결을 확인해주세요.');
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
export const api = {
  status: () => request<{ aiEnabled: boolean }>('/api/status'),
  recommend: (settings: Settings, options: { mode: 'ai' | 'catalog'; cuisine: Cuisine; filter: Filter; more?: boolean; recentMenus?: string[]; previousKeys?: string[] }, signal?: AbortSignal) => request<Recommendation>('/api/recommend', { ...settings, shopping: undefined, stock: undefined, undoStock: undefined, ...options }, signal),
  recognize: (image: string) => request<{ ingredients: string[] }>('/api/recognize', { image }),
  explain: (name: string, reason: string) => request<{ explanation: string }>('/api/explain', { name, reason }),
  guide: (event: 'question' | 'tutorial' | 'rescue', question: string, context: unknown, signal?: AbortSignal) => request<{ title: string; message: string }>('/api/guide', { event, question, context }, signal),
  feed: (viewer: string, cursor?: string) => request<{ posts: Post[]; nextCursor: string | null }>(`/api/community/posts?viewer=${encodeURIComponent(viewer)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
  post: (id: string, viewer: string) => request<Post>(`/api/community/posts/${encodeURIComponent(id)}?viewer=${encodeURIComponent(viewer)}`),
  createPost: (data: { author: string; title: string; content: string; image?: string }) => request<Post>('/api/community/posts', data),
  like: (id: string, viewer: string, liked: boolean) => request<Post>(`/api/community/posts/${encodeURIComponent(id)}/like`, { viewer, liked }),
  comment: (id: string, viewer: string, author: string, content: string) => request<Post>(`/api/community/posts/${encodeURIComponent(id)}/comments`, { viewer, author, content }),
};
