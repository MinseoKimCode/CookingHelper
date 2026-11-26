import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { recoverLocalData } from '../mobile/backup.ts';
import { communityReceipt } from '../mobile/communityReceipt.ts';
import { migrateShopping } from '../mobile/recipeTools.ts';

function storageWith(raw) {
  const values = new Map([['hankki.mobile.v1', raw]]);
  const module = { exports: {} };
  const js = ts.transpileModule(readFileSync('mobile/services/storage.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(js, {
    module,
    exports: module.exports,
    Uint8Array,
    require: (name) =>
      name.includes('async-storage')
        ? {
            getItem: async (key) => values.get(key) ?? null,
            setItem: async (key, value) => {
              values.set(key, value);
            },
          }
        : name === 'expo-crypto'
          ? { getRandomValues: (bytes) => bytes.fill(1) }
          : name.includes('recipeTools')
            ? { migrateShopping }
            : { recoverLocalData },
  });
  return { load: module.exports.loadStorage, values };
}
test('valid JSON with malformed fields recovers defaults and preserves valid records', async () => {
  const log = {
    id: 'log',
    recipeId: 'r',
    name: 'Soup',
    date: '2026-11-26',
    servings: 2,
    rating: 5,
    memo: '',
  };
  const raw = JSON.stringify({
    settings: { ingredients: null, pantry: ['Salt'], excluded: 4, servings: -1, stock: 'bad' },
    nickname: 4,
    viewer: {},
    saved: [null],
    logs: [log, null],
  });
  const storage = storageWith(raw),
    data = JSON.parse(JSON.stringify(await storage.load()));
  assert.equal(data.settings.ingredients.length, 0);
  assert.deepEqual(data.settings.pantry, ['Salt']);
  assert.equal(data.settings.servings, 2);
  assert.equal(data.saved.length, 0);
  assert.deepEqual(data.logs, [log]);
  assert.equal(data.nickname, '');
  assert.match(data.viewer, /^[0-9a-f-]{36}$/);
  assert.equal(storage.values.get('hankki.mobile.v1.corrupt'), raw);
});
test('ownership receipt stays valid when a React state updater executes later', () => {
  const response = { id: 'post', ownerToken: 'a'.repeat(64), ownedCommentId: 'comment' };
  const { post, grant } = communityReceipt(response);
  const queued = (current) => ({ ...current, [grant.id]: grant.token });
  assert.equal(post.ownerToken, undefined);
  assert.equal(post.ownedCommentId, undefined);
  assert.deepEqual(queued({}), { comment: 'a'.repeat(64) });
  assert.equal(response.ownerToken, 'a'.repeat(64));
});
