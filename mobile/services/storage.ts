import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { CookLog, Recipe, Settings } from '../types';
import { migrateShopping } from '../recipeTools';
import { recoverLocalData } from '../backup';

const KEY = 'hankki.mobile.v1';
export interface Stored {
  saved: Recipe[];
  settings: Settings;
  viewer: string;
  nickname: string;
  tutorialStep: number | null;
  tutorialCompleted: boolean;
  logs: CookLog[];
}
export const defaultSettings: Settings = {
  ingredients: [],
  pantry: [],
  excluded: [],
  level: 0,
  servings: 2,
  cuisine: 'all',
  maxExtraIngredients: 2,
  resultCount: 6,
  diet: 'none',
};
// Local HTTP on mobile browsers supports getRandomValues even when randomUUID is unavailable.
function createViewerId() {
  const bytes = Crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
export async function loadStorage(): Promise<Stored> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('Invalid storage');
      const recovered = recoverLocalData(
        {
          ...data,
          settings: { ...data.settings, shopping: migrateShopping(data.settings?.shopping) },
        },
        defaultSettings,
      );
      if (
        JSON.stringify(recovered.settings) !== JSON.stringify(data.settings) ||
        recovered.saved.length !== data.saved?.length ||
        recovered.logs.length !== data.logs?.length
      )
        await AsyncStorage.setItem(KEY + '.corrupt', raw);
      return {
        ...recovered,
        viewer:
          typeof data.viewer === 'string' &&
          /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(data.viewer)
            ? data.viewer
            : createViewerId(),
        tutorialStep:
          Number.isInteger(data.tutorialStep) && data.tutorialStep >= 0 && data.tutorialStep < 9
            ? data.tutorialStep
            : null,
        tutorialCompleted: !!data.tutorialCompleted,
      };
    } catch {
      // Preserve corrupt data before recovered defaults are saved.
      await AsyncStorage.setItem(KEY + '.corrupt', raw);
    }
  }
  // Import saved recipe snapshots from the earlier browser app on the same origin.
  const legacy = await AsyncStorage.getItem('hankki');
  let saved: Recipe[] = [];
  try {
    const data = JSON.parse(legacy || '{}');
    if (Array.isArray(data.savedRecipes))
      saved = recoverLocalData({ saved: data.savedRecipes }, defaultSettings).saved;
  } catch {
    /* Start clean if old storage was corrupt. */
  }
  const oldViewer = await AsyncStorage.getItem('hankki.community.viewer');
  const oldNickname = await AsyncStorage.getItem('hankki.community.nickname');
  return {
    saved,
    settings: defaultSettings,
    logs: [],
    viewer:
      oldViewer && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(oldViewer)
        ? oldViewer
        : createViewerId(),
    nickname: oldNickname || '',
    tutorialStep: null,
    tutorialCompleted: false,
  };
}
export const saveStorage = (data: Stored) => AsyncStorage.setItem(KEY, JSON.stringify(data));
