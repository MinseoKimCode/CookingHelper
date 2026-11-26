import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  CatalogRow,
  Channel,
  Cuisine,
  Filter,
  Post,
  Ranking,
  Recipe,
  Recommendation,
  Review,
  Settings,
  Theme,
  Video,
  VideoAnalysis,
  YtChannel,
} from '../types';

// A physical phone must address the PC's LAN IP, never the phone's localhost.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const configured = process.env.EXPO_PUBLIC_API_URL;
const webOrigin =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? __DEV__
      ? window.location.protocol + '//' + window.location.hostname + ':3000'
      : window.location.origin
    : undefined;
export const API_URL = (
  configured ||
  webOrigin ||
  (devHost
    ? `http://${devHost}:3000`
    : Platform.OS === 'android'
      ? 'http://10.0.2.2:3000'
      : 'http://localhost:3000')
).replace(/\/$/, '');
export const assetUrl = (url?: string | null) =>
  !url ? undefined : /^https?:\/\//.test(url) ? url : `${API_URL}${url}`;

export async function request<T>(
  path: string,
  data?: unknown,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 330000); // Generation + independent review can each take 150s.
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (cause) {
      throw new Error(
        response.ok
          ? '서버 응답 형식을 확인할 수 없어요.'
          : `서버 요청에 실패했어요 (${response.status}). 잠시 후 다시 시도해 주세요.`,
        { cause },
      );
    }
    if (!result || typeof result !== 'object')
      throw new Error('서버 응답 형식을 확인할 수 없어요.');
    if (!response.ok) throw new Error(result.error || `요청에 실패했어요 (${response.status}).`);
    return result as T;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error('요청을 중단했거나 응답 시간이 초과됐어요.', { cause: error });
    if (error instanceof TypeError)
      throw new Error('서버에 연결할 수 없어요. API 주소와 Wi-Fi 연결을 확인해주세요.', {
        cause: error,
      });
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
export const api = {
  status: () => request<{ aiEnabled: boolean; youtubeEnabled?: boolean }>('/api/status'),
  catalog: (
    query: {
      q?: string;
      cuisine?: string;
      maxTime?: number;
      level?: number;
      caloriesMax?: number;
      source?: '' | 'video' | 'ai';
      sort?: string;
      page?: number;
      size?: number;
    },
    signal?: AbortSignal,
  ) =>
    request<{ recipes: CatalogRow[]; total: number; page: number; hasMore: boolean }>(
      '/api/recipes?' +
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '' && v !== 'all')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          .join('&'),
      undefined,
      signal,
    ),
  youtubeVideos: (
    q: string,
    order: 'relevance' | 'viewCount' | 'date' = 'relevance',
    signal?: AbortSignal,
  ) =>
    request<{ videos: Video[] }>(
      `/api/youtube/videos?q=${encodeURIComponent(q)}&order=${order}`,
      undefined,
      signal,
    ),
  youtubeChannels: (ids: string[] = [], signal?: AbortSignal) =>
    request<{ channels: YtChannel[] }>(
      `/api/youtube/channels${ids.length ? `?ids=${ids.join(',')}` : ''}`,
      undefined,
      signal,
    ),
  videoRecipe: (url: string, notes = '', signal?: AbortSignal) =>
    request<{ recipe: Recipe; reused: boolean }>('/api/video/recipe', { url, notes }, signal),
  recommend: (
    settings: Settings,
    options: {
      mode: 'ai' | 'catalog';
      cuisine: Cuisine;
      filter: Filter;
      more?: boolean;
      recentMenus?: string[];
      previousKeys?: string[];
      theme?: Theme;
      query?: string;
      tastes?: string[];
    },
    signal?: AbortSignal,
  ) =>
    request<Recommendation>(
      '/api/recommend',
      {
        ...settings,
        shopping: undefined,
        stock: undefined,
        undoStock: undefined,
        diet: settings.diet || 'none',
        ...options,
      },
      signal,
    ),
  rankings: (period: 'today' | 'week' | 'all', signal?: AbortSignal) =>
    request<{ rankings: Ranking[] }>(`/api/rankings?period=${period}`, undefined, signal),
  recipe: (id: string) => request<Ranking>(`/api/recipes/${encodeURIComponent(id)}`),
  view: (id: string, viewer: string) =>
    request<Ranking>(`/api/recipes/${encodeURIComponent(id)}/view`, { viewer }),
  reviews: (id: string, signal?: AbortSignal) =>
    request<{ reviews: Review[]; rating: number; reviewCount: number; views: number }>(
      `/api/recipes/${encodeURIComponent(id)}/reviews`,
      undefined,
      signal,
    ),
  review: (id: string, data: { viewer: string; author: string; rating: number; content: string }) =>
    request<{ reviews: Review[]; rating: number; reviewCount: number; views: number }>(
      `/api/recipes/${encodeURIComponent(id)}/reviews`,
      data,
    ),
  report: (id: string, data: { viewer: string; reason: string; detail: string }) =>
    request<{ received: boolean }>(`/api/recipes/${encodeURIComponent(id)}/reports`, data),
  channels: (signal?: AbortSignal) =>
    request<{ channels: Channel[] }>('/api/channels', undefined, signal),
  analyzeVideo: (url: string, notes: string, signal?: AbortSignal) =>
    request<VideoAnalysis>('/api/video/analyze', { url, notes }, signal),
  recognize: (image: string) => request<{ ingredients: string[] }>('/api/recognize', { image }),
  explain: (name: string, reason: string) =>
    request<{ explanation: string }>('/api/explain', { name, reason }),
  guide: (
    event: 'question' | 'tutorial' | 'rescue',
    question: string,
    context: unknown,
    signal?: AbortSignal,
  ) =>
    request<{ title: string; message: string }>('/api/guide', { event, question, context }, signal),
  feed: (viewer: string, cursor?: string) =>
    request<{ posts: Post[]; nextCursor: string | null }>(
      `/api/community/posts?viewer=${encodeURIComponent(viewer)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  post: (id: string, viewer: string) =>
    request<Post>(
      `/api/community/posts/${encodeURIComponent(id)}?viewer=${encodeURIComponent(viewer)}`,
    ),
  createPost: (data: { author: string; title: string; content: string; image?: string }) =>
    request<Post>('/api/community/posts', data),
  like: (id: string, viewer: string, liked: boolean) =>
    request<Post>(`/api/community/posts/${encodeURIComponent(id)}/like`, { viewer, liked }),
  comment: (id: string, viewer: string, author: string, content: string) =>
    request<Post>(`/api/community/posts/${encodeURIComponent(id)}/comments`, {
      viewer,
      author,
      content,
    }),
};
