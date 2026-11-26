import type { CookLog, Recipe, ShoppingItem, Sort } from './types.ts';

// Korean kitchen measures: 1큰술 = 15ml, 1작은술 = 5ml, 1컵 = 200ml (밥숟가락·종이컵 기준).
const measures: Record<string, number> = { 큰술: 15, 밥숟가락: 15, T: 15, Ts: 15, 작은술: 5, 티스푼: 5, t: 5, ts: 5, 컵: 200, 종이컵: 180 };

export function formatAmount(value: number) {
  if (!Number.isFinite(value)) return '';
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded);
}
export function scaleAmount(amount: number, from: number, to: number) {
  return from > 0 ? amount * to / from : amount;
}
/** Converts spoon and cup measures to ml; other units are returned unchanged. */
export function convertUnit(amount: number, unit: string) {
  const ml = measures[unit.trim()];
  return ml ? { amount: amount * ml, unit: 'ml', converted: true } : { amount, unit, converted: false };
}
export const storeSearchUrl = (name: string) => 'https://www.coupang.com/np/search?q=' + encodeURIComponent(name);
export const videoSearchUrl = (name: string) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(name + ' 레시피');

export function mergeShopping(list: ShoppingItem[], items: ShoppingItem[]) {
  const result = list.map(item => ({ ...item }));
  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    const existing = result.find(row => row.name === name);
    if (existing) { existing.checked = false; if (item.recipe && !existing.recipe?.includes(item.recipe)) existing.recipe = existing.recipe ? `${existing.recipe}, ${item.recipe}` : item.recipe; if (!existing.amount && item.amount) existing.amount = item.amount; }
    else result.push({ ...item, name, checked: false });
  }
  return result.slice(0, 200);
}
/** Earlier versions stored the shopping list as plain names. */
export function migrateShopping(value: unknown): ShoppingItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => typeof item === 'string' ? [{ name: item }] :
    item && typeof item === 'object' && typeof (item as ShoppingItem).name === 'string' ? [item as ShoppingItem] : []);
}
export function shoppingText(list: ShoppingItem[]) {
  return ['한끼 장보기 리스트', ...list.filter(item => !item.checked).map(item => `□ ${item.name}${item.amount ? ` ${item.amount}` : ''}${item.recipe ? ` (${item.recipe})` : ''}`)].join('\n');
}

export function sortRecipes(rows: Recipe[], sort: Sort, views: Record<string, number> = {}) {
  if (sort === 'recommended') return rows;
  const copy = [...rows];
  if (sort === 'popular') copy.sort((a, b) => (views[b.id] || 0) - (views[a.id] || 0));
  if (sort === 'time') copy.sort((a, b) => a.time - b.time);
  if (sort === 'name') copy.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  if (sort === 'calories') copy.sort((a, b) => (a.calories ?? Infinity) - (b.calories ?? Infinity));
  return copy;
}

export function daysUntil(date: string, today: string) {
  return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
}
export function localToday(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function cookStats(logs: CookLog[], today: string) {
  const month = today.slice(0, 7);
  const thisMonth = logs.filter(log => log.date.startsWith(month));
  const counts = new Map<string, number>();
  for (const log of logs) counts.set(log.name, (counts.get(log.name) || 0) + 1);
  const favorite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const rated = logs.filter(log => log.rating > 0);
  let streak = 0;
  const days = new Set(logs.map(log => log.date));
  for (let day = today; days.has(day); streak++) day = new Date(Date.parse(day + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  return {
    total: logs.length, month: thisMonth.length, streak,
    favorite: favorite ? { name: favorite[0], count: favorite[1] } : null,
    average: rated.length ? Math.round(rated.reduce((sum, log) => sum + log.rating, 0) / rated.length * 10) / 10 : 0,
    calories: thisMonth.reduce((sum, log) => sum + (log.calories || 0) * log.servings, 0),
  };
}

export function recipeFaq(recipe: Recipe) {
  const level = ['초보도 따라 할 수 있는 기본 조리', '불 조절이나 익힘 순서를 판단해야 하는 중급', '정교한 작업이나 동시 조리가 필요한 고급'][recipe.level];
  const rows = [
    { q: '이 요리는 몇 인분 기준인가요?', a: `${recipe.servings}인분 기준이에요. 상세 화면에서 인분을 바꾸면 재료 분량이 함께 바뀌어요.` },
    { q: '조리 난이도는 어느 정도인가요?', a: `${level} 단계예요.` },
    { q: '조리 시간은 얼마나 걸리나요?', a: `약 ${recipe.time}분이에요${recipe.prepTime ? ` (손질 ${recipe.prepTime}분 포함)` : ''}${recipe.restTime ? `. 별도로 ${recipe.restTime}분 동안 숙성·대기 시간이 있어요` : ''}.` },
    { q: '알레르기 유발 성분이 있나요?', a: recipe.allergens?.length ? `${recipe.allergens.join(', ')}이(가) 포함돼요. 실제 제품의 원재료도 꼭 확인해주세요.` : recipe.allergens ? '표시된 알레르기 유발 성분은 없어요. 가공식품은 원재료를 확인해주세요.' : '이 레시피는 알레르기 정보가 없어요. 재료 목록을 직접 확인해주세요.' },
  ];
  if (recipe.calories) rows.push({ q: '칼로리는 얼마나 되나요?', a: `1인분 약 ${recipe.calories}kcal로 추정돼요. 재료와 분량에 따라 달라질 수 있어요.` });
  if (recipe.storage) rows.push({ q: '남은 음식은 어떻게 보관하나요?', a: recipe.storage });
  rows.push({ q: '재료를 다른 것으로 대체할 수 있나요?', a: recipe.swaps.length ? `${recipe.swaps.map(s => `${s.original} → ${s.name}`).join(', ')}로 바꿀 수 있어요. 재료 목록 아래에서 사용법을 확인하세요.` : '내 재료로 바꿀 수 있는 대체안은 없어요. 조리 중 "재료가 없어요"를 누르면 몬스터가 함께 방법을 찾아줘요.' });
  return rows;
}

/**
 * Catalog, ranking and video recipes were generated for someone else's fridge, so what is "missing"
 * is recomputed against this user's ingredients and seasonings before showing them.
 */
export function personalize(recipe: Recipe, owned: string[], pantry: string[]): Recipe {
  const have = new Set([...owned, ...pantry, '물']);
  const all = [...recipe.ingredients, ...recipe.seasonings];
  return { ...recipe,
    ingredients: all.filter(item => !pantry.includes(item.name) || owned.includes(item.name)).map(item => ({ ...item, owned: have.has(item.name) })),
    seasonings: all.filter(item => pantry.includes(item.name) && !owned.includes(item.name)).map(item => ({ ...item, owned: true })),
    missing: all.filter(item => !have.has(item.name)).map(item => item.name), missingSeasonings: [] };
}
export const compactCount = (value: number) => value >= 100000000 ? `${Math.round(value / 10000000) / 10}억` : value >= 10000 ? `${value >= 10000000 ? Math.round(value / 10000) : Math.round(value / 1000) / 10}만` : value >= 1000 ? `${Math.round(value / 100) / 10}천` : String(value);
export const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
