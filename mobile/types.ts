export type Level = 0 | 1 | 2;
export type Cuisine = 'all' | 'korean' | 'chinese' | 'japanese' | 'western' | 'asian' | 'snack' | 'fusion' | 'dessert' | 'other';
export type Filter = 'all' | 'ready' | 'ten' | 'quick' | 'thirty' | 'easy' | 'light';
export type Theme = '' | 'taste' | 'seasonal' | 'budget';
export type Diet = 'none' | 'vegetarian' | 'vegan' | 'lowcal' | 'highprotein';
export type Sort = 'recommended' | 'popular' | 'time' | 'name' | 'calories';
export type Tab = 'pantry' | 'recipes' | 'saved' | 'kitchen' | 'community';
export interface Ingredient { name: string; amount: number; unit: string; owned?: boolean }
export interface Step { title: string; text: string; minutes: number; heat: string; passive?: boolean }
export interface Recipe {
  id: string; name: string; subtitle?: string; cuisine: Cuisine; source?: string;
  time: number; level: Level; servings: number; reason: string; pair: string;
  ingredients: Ingredient[]; seasonings: Ingredient[]; steps: Step[];
  missing: string[]; missingSeasonings?: string[]; menuKey?: string;
  swaps: { original: string; name: string; amount?: number; unit?: string; note: string }[];
  photo?: { url: string; generated?: boolean; author?: string; license?: string; sourceUrl?: string; licenseUrl?: string };
  prepTime?: number; restTime?: number; calories?: number; cost?: number;
  diet?: string[]; allergens?: string[]; tools?: { name: string; required: boolean }[];
  tips?: string; storage?: string;
  video?: { id: string; url: string; title: string; channel: string; thumbnail?: string; views?: number; likes?: number; seconds?: number };
}
export interface Stock { name: string; quantity: number; unit: string; expires: string }
export interface ShoppingItem { name: string; amount?: string; recipe?: string; checked?: boolean }
export interface CookLog { id: string; recipeId: string; name: string; date: string; servings: number; rating: number; memo: string; calories?: number }
export interface Settings { shopping?: ShoppingItem[]; stock?: Stock[]; undoStock?: Stock[]; priorityIngredient?: string; ingredients: string[]; pantry: string[]; excluded: string[]; level: Level; servings: number; cuisine: Cuisine; maxExtraIngredients: number; resultCount: number; diet?: Diet }
export interface Recommendation { recipes: Recipe[]; mode: string; message?: string }
export interface Comment { id: string; author: string; content: string; createdAt: string }
export interface Post {
  id: string; author: string; title: string; content: string; createdAt: string;
  image: string | null; liked: boolean; likeCount: number; commentCount: number;
  comments?: Comment[]; revision: number;
}
export interface Ranking { recipe: Recipe; views: number; rating: number; reviewCount: number }
export interface CatalogRow extends Ranking { createdAt: string }
export interface Video { id: string; url: string; title: string; channel: string; channelId: string; thumbnail: string; publishedAt: string; views: number; likes: number; seconds: number; recipeReady?: boolean }
export interface YtChannel { id: string; name: string; thumbnail: string; url: string; subscribers: number; videoCount: number }
export interface Review { id: string; author: string; rating: number; content: string; createdAt: string }
export interface Channel { name: string; analyses: number; updatedAt: string; channelId?: string; videos: { url: string; title: string }[] }
export interface VideoAnalysis {
  found: boolean; dish: string; servings: number; url: string; title: string; author: string; source: string; message?: string;
  ingredients: { name: string; amount: string; unit: string }[]; steps: string[];
}
export const cuisineOptions: { value: Cuisine; label: string }[] = [
  { value: 'all', label: '전체' }, { value: 'korean', label: '한식' }, { value: 'chinese', label: '중식' },
  { value: 'japanese', label: '일식' }, { value: 'western', label: '양식' }, { value: 'asian', label: '아시안' },
  { value: 'snack', label: '분식' }, { value: 'fusion', label: '퓨전' }, { value: 'dessert', label: '디저트' }, { value: 'other', label: '기타' },
];
export const cuisineIcons: Partial<Record<Cuisine, string>> = {
  korean: '🍚', chinese: '🥟', japanese: '🍣', western: '🍝', asian: '🍜', snack: '🍢', fusion: '🌮', dessert: '🍰',
};
export const filterOptions: { value: Filter; label: string }[] = [
  { value: 'all', label: '모든 조건' }, { value: 'ready', label: '바로 가능' }, { value: 'ten', label: '10분 안에' },
  { value: 'quick', label: '20분 이내' }, { value: 'thirty', label: '30분 안에' }, { value: 'easy', label: '초보도 성공' }, { value: 'light', label: '가볍게 500kcal↓' },
];
export const sortOptions: { value: Sort; label: string }[] = [
  { value: 'recommended', label: '추천순' }, { value: 'popular', label: '인기순' }, { value: 'time', label: '조리시간순' },
  { value: 'name', label: '이름순' }, { value: 'calories', label: '칼로리 낮은순' },
];
export const dietOptions: { value: Diet; label: string }[] = [
  { value: 'none', label: '제한 없음' }, { value: 'vegetarian', label: '채식' }, { value: 'vegan', label: '비건' },
  { value: 'lowcal', label: '저칼로리' }, { value: 'highprotein', label: '고단백' },
];
export const levelLabels = ['초보', '중급', '고급'] as const;
export const parseIngredients = (value: string) => [...new Set(value.split(/[,，\n·]+/).map(x => x.trim()).filter(Boolean))];
export const missingCount = (recipe: Recipe) => recipe.missing.length + (recipe.missingSeasonings?.length ?? 0);
