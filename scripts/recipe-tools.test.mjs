import test from 'node:test';
import assert from 'node:assert/strict';
import { convertUnit, cookStats, daysUntil, formatAmount, mergeShopping, migrateShopping, recipeFaq, scaleAmount, shoppingText, sortRecipes } from '../mobile/recipeTools.ts';

test('servings scale amounts and spoon measures convert to ml', () => {
  assert.equal(scaleAmount(2, 2, 3), 3);
  assert.equal(formatAmount(scaleAmount(1, 2, 3)), '1.5');
  assert.deepEqual(convertUnit(2, '큰술'), { amount: 30, unit: 'ml', converted: true });
  assert.deepEqual(convertUnit(1, '작은술'), { amount: 5, unit: 'ml', converted: true });
  assert.deepEqual(convertUnit(200, 'g'), { amount: 200, unit: 'g', converted: false });
});
test('shopping list merges duplicates and migrates the old string list', () => {
  const merged = mergeShopping([{ name: '대파', checked: true, recipe: '라면' }], [{ name: '대파', recipe: '볶음밥' }, { name: ' 두부 ', amount: '1모' }, { name: '' }]);
  assert.deepEqual(merged, [{ name: '대파', checked: false, recipe: '라면, 볶음밥' }, { name: '두부', amount: '1모', checked: false }]);
  assert.deepEqual(migrateShopping(['양파', { name: '감자' }, 3]), [{ name: '양파' }, { name: '감자' }]);
  assert.equal(shoppingText(merged), '한끼 장보기 리스트\n□ 대파 (라면, 볶음밥)\n□ 두부 1모');
});
test('cook stats count this month, streaks and favourites', () => {
  const log = (date, name, rating = 0) => ({ id: date + name, recipeId: 'x', name, date, servings: 2, rating, memo: '', calories: 300 });
  const stats = cookStats([log('2026-11-26', '김치볶음밥', 5), log('2026-11-25', '김치볶음밥', 3), log('2026-10-01', '라면')], '2026-11-26');
  assert.deepEqual(stats, { total: 3, month: 2, streak: 2, favorite: { name: '김치볶음밥', count: 2 }, average: 4, calories: 1200 });
  assert.equal(daysUntil('2026-11-29', '2026-11-26'), 3);
});
test('sorting and FAQ use the recipe details', () => {
  const a = { id: 'a', name: '나물', time: 20, calories: 200 }, b = { id: 'b', name: '가지', time: 10 };
  assert.deepEqual(sortRecipes([a, b], 'time').map(r => r.id), ['b', 'a']);
  assert.deepEqual(sortRecipes([a, b], 'name').map(r => r.id), ['b', 'a']);
  assert.deepEqual(sortRecipes([b, a], 'calories').map(r => r.id), ['a', 'b']);
  assert.deepEqual(sortRecipes([a, b], 'popular', { b: 3 }).map(r => r.id), ['b', 'a']);
  const faq = recipeFaq({ name: '국수', servings: 2, level: 1, time: 30, prepTime: 15, restTime: 2, allergens: ['대두', '밀'], calories: 450, storage: '냉장 2일', swaps: [] });
  assert.ok(faq.some(row => row.a.includes('대두, 밀')));
  assert.ok(faq.some(row => row.a === '냉장 2일'));
});
test('catalog recipes are re-checked against this user fridge', async () => {
  const { personalize, compactCount, duration } = await import('../mobile/recipeTools.ts');
  const recipe = { ingredients: [{ name: '김치', amount: 1, unit: '컵' }, { name: '밥', amount: 2, unit: '공기' }, { name: '물', amount: 50, unit: 'ml' }], seasonings: [{ name: '간장', amount: 1, unit: '큰술' }], missing: ['다른 사람 기준'], swaps: [] };
  const mine = personalize(recipe, ['밥'], ['간장']);
  assert.deepEqual(mine.missing, ['김치']);
  assert.deepEqual(mine.seasonings.map(s => s.name), ['간장']);
  assert.deepEqual(mine.ingredients.map(i => [i.name, i.owned]), [['김치', false], ['밥', true], ['물', true]]);
  assert.equal(compactCount(5420000), '542만'); assert.equal(compactCount(12534000), '1253만'); assert.equal(compactCount(1530), '1.5천'); assert.equal(duration(330), '5:30');
});
