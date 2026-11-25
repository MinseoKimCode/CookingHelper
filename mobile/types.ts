export type Level = 0 | 1 | 2;
export type Cuisine = 'all' | 'korean' | 'western' | 'japanese' | 'other';
export type Filter = 'all' | 'ready' | 'quick' | 'easy';
export type Tab = 'pantry' | 'recipes' | 'saved' | 'community';
export interface Ingredient { name: string; amount: number; unit: string; owned?: boolean }
export interface Step { title: string; text: string; minutes: number; heat: string }
export interface Recipe {
  id: string; name: string; subtitle?: string; cuisine: Cuisine; source?: string;
  time: number; level: Level; servings: number; reason: string; pair: string;
  ingredients: Ingredient[]; seasonings: Ingredient[]; steps: Step[];
  missing: string[]; missingSeasonings?: string[]; menuKey?: string;
  swaps: { original: string; name: string; amount?: number; unit?: string; note: string }[];
  photo?: { url: string; generated?: boolean; author?: string; license?: string; sourceUrl?: string; licenseUrl?: string };
}
export interface Stock { name: string; quantity: number; unit: string; expires: string }
export interface Settings { shopping?: string[]; stock?: Stock[]; undoStock?: Stock[]; priorityIngredient?: string; ingredients: string[]; pantry: string[]; excluded: string[]; level: Level; servings: number; cuisine: Cuisine; maxExtraIngredients: number; resultCount: number }
export interface Recommendation { recipes: Recipe[]; mode: string; message?: string }
export interface Comment { id: string; author: string; content: string; createdAt: string }
export interface Post {
  id: string; author: string; title: string; content: string; createdAt: string;
  image: string | null; liked: boolean; likeCount: number; commentCount: number;
  comments?: Comment[]; revision: number;
}
export const cuisineOptions: { value: Cuisine; label: string }[] = [
  { value: 'all', label: '전체' }, { value: 'korean', label: '한식' },
  { value: 'western', label: '양식' }, { value: 'japanese', label: '일식' }, { value: 'other', label: '기타' },
];
export const filterOptions: { value: Filter; label: string }[] = [
  { value: 'all', label: '모든 조건' }, { value: 'ready', label: '바로 가능' },
  { value: 'quick', label: '20분 이내' }, { value: 'easy', label: '초보' },
];
export const levelLabels = ['초보', '중급', '고급'] as const;
export const parseIngredients = (value: string) => [...new Set(value.split(/[,，\n·]+/).map(x => x.trim()).filter(Boolean))];
export const missingCount = (recipe: Recipe) => recipe.missing.length + (recipe.missingSeasonings?.length ?? 0);
