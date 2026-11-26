import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup } from '../mobile/backup.ts';
import { utf8Size, MAX_BACKUP_BYTES } from '../mobile/backup.ts';

test('backup limits use UTF-8 bytes for Korean and supplementary characters', () => {
  const text = '\uAC00'.repeat(1800000);
  assert.equal(utf8Size(text), Buffer.byteLength(text));
  assert.equal(utf8Size('a\uAC00\u{1F372}'), 8);
  const oversized = JSON.stringify({ format: 'hankki', version: 1, data: {}, note: text });
  assert.ok(oversized.length < MAX_BACKUP_BYTES);
  assert.ok(Buffer.byteLength(oversized) > MAX_BACKUP_BYTES);
  assert.throws(() => parseBackup(oversized), /5MB/);
});

const data = {
  saved: [],
  logs: [
    {
      id: 'log',
      recipeId: 'r',
      name: 'Soup',
      date: '2026-11-26',
      servings: 2,
      rating: 4,
      memo: '',
    },
  ],
  nickname: 'Cook',
  settings: {
    ingredients: ['Tofu'],
    pantry: [],
    excluded: [],
    level: 0,
    servings: 2,
    cuisine: 'all',
    maxExtraIngredients: 2,
    resultCount: 6,
    shopping: [{ name: 'Onion', checked: false }],
  },
};
test('versioned backup round-trips kitchen data', () => {
  assert.deepEqual(parseBackup(createBackup(data)), data);
});

test('backup validates optional substitution quantities and units', () => {
  const recipe = {
    id: 'r',
    name: 'Soup',
    cuisine: 'korean',
    time: 10,
    level: 0,
    servings: 2,
    reason: '',
    pair: '',
    ingredients: [],
    seasonings: [],
    steps: [],
    missing: [],
    swaps: [{ original: 'Tofu', name: 'Egg', note: '' }],
  };
  const withSwap = (swap) => ({ ...data, saved: [{ ...recipe, swaps: [swap] }] });
  const base = recipe.swaps[0];
  for (const swap of [base, { ...base, amount: 0, unit: '' }, { ...base, amount: 2, unit: '개' }]) {
    assert.deepEqual(parseBackup(createBackup(withSwap(swap))), withSwap(swap));
  }
  for (const fields of [
    { amount: {} },
    { amount: '2' },
    { amount: null },
    { amount: -1 },
    { amount: 1000001 },
    { unit: {} },
    { unit: null },
    { unit: 'x'.repeat(31) },
  ]) {
    assert.throws(() =>
      parseBackup(
        JSON.stringify({
          format: 'hankki',
          version: 1,
          data: withSwap({ ...base, ...fields }),
        }),
      ),
    );
  }
});
test('backup rejects unsupported versions, malformed lists and out-of-range values', () => {
  const valid = JSON.parse(createBackup(data));
  for (const mutate of [
    (v) => (v.version = 2),
    (v) => (v.data.settings.ingredients = 'bad'),
    (v) => (v.data.settings.servings = 0),
    (v) => (v.data.logs[0].rating = 99),
    (v) => (v.data.saved = [{ id: 'bad' }]),
    (v) => (v.data.settings.stock = [{ name: 'Tofu', quantity: -1, unit: 'g', expires: '' }]),
  ]) {
    const copy = structuredClone(valid);
    mutate(copy);
    assert.throws(() => parseBackup(JSON.stringify(copy)));
  }
  assert.throws(() => parseBackup('{'));
  assert.throws(() => parseBackup(' '.repeat(5 * 1024 * 1024 + 1)));
});
