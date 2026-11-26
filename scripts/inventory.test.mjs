import test from 'node:test';
import assert from 'node:assert/strict';
import { deduct, restore } from '../mobile/inventory.ts';
const settings = {
  ingredients: ['달걀', '두부'],
  stock: [{ name: '달걀', quantity: 3, unit: '개', expires: '' }],
};
test('confirmed quantities deduct and restore, including depleted inventory', () => {
  for (const used of [2, 3]) {
    const next = deduct(settings, { 달걀: used });
    assert.equal(next.stock[0]?.quantity ?? 0, 3 - used);
    assert.equal(next.ingredients.includes('달걀'), used < 3);
    const restored = restore(next);
    assert.deepEqual(restored.stock, settings.stock);
    assert.deepEqual(new Set(restored.ingredients), new Set(settings.ingredients));
    assert.equal(restore(restored), restored);
  }
});
test('untracked ingredients and excessive quantities never change stock', () => {
  assert.equal(deduct(settings, { 두부: 2 }), settings);
  assert.equal(deduct(settings, { 달걀: 4 }), settings);
});
