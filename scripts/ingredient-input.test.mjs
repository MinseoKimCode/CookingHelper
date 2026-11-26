import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeIngredientNames, validateIngredientNames } from '../mobile/types.ts';
import { createBackup, recoverLocalData } from '../mobile/backup.ts';

test('ingredient input accepts server boundaries and rejects oversized names and lists', () => {
  const names = Array.from({ length: 60 }, (_, i) => `ingredient${i}`);
  assert.equal(validateIngredientNames(names), true);
  assert.equal(validateIngredientNames([...names, 'extra']), false);
  assert.equal(validateIngredientNames(['가'.repeat(40)]), true);
  assert.equal(validateIngredientNames(['가'.repeat(41)]), false);
});

test('photo merge rejects overflow without truncating either list and permits duplicates at capacity', () => {
  const existing = Array.from({ length: 60 }, (_, i) => `ingredient${i}`);
  const incoming = ['new ingredient'];
  assert.equal(mergeIngredientNames(existing, incoming), null);
  assert.equal(existing.length, 60);
  assert.deepEqual(incoming, ['new ingredient']);
  assert.deepEqual(mergeIngredientNames(existing, [existing[0]]), existing);
  assert.deepEqual(mergeIngredientNames(existing.slice(0, 59), incoming), [
    ...existing.slice(0, 59),
    ...incoming,
  ]);
});

test('accepted pantry and allergy names survive persistence recovery and backup', () => {
  const defaults = {
    ingredients: [],
    pantry: [],
    excluded: [],
    level: 0,
    servings: 2,
    cuisine: 'all',
    maxExtraIngredients: 2,
    resultCount: 6,
  };
  const names = Array.from({ length: 60 }, (_, i) => `${i} ${'가'.repeat(37)}`);
  assert.equal(validateIngredientNames(names), true);
  const data = {
    settings: { ...defaults, pantry: names, excluded: names },
    saved: [],
    logs: [],
    nickname: '',
  };
  assert.deepEqual(recoverLocalData(JSON.parse(JSON.stringify(data)), defaults), data);
  assert.doesNotThrow(() => createBackup(data));
});
