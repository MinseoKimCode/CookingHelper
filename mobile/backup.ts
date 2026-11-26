import type { CookLog, Recipe, Settings } from './types';

export interface BackupData {
  saved: Recipe[];
  settings: Settings;
  logs: CookLog[];
  nickname: string;
}
export interface Backup {
  format: 'hankki';
  version: 1;
  exportedAt: string;
  data: BackupData;
}
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export function utf8Size(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, limit = 1000): value is string =>
  typeof value === 'string' && value.length <= limit;
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const list = (
  value: unknown,
  check: (item: Record<string, unknown>) => boolean,
  max = 1000,
): boolean =>
  Array.isArray(value) && value.length <= max && value.every((item) => object(item) && check(item));
const strings = (value: unknown) =>
  Array.isArray(value) && value.length <= 120 && value.every((item) => text(item, 80));
const ingredient = (v: Record<string, unknown>) =>
  text(v.name, 80) && number(v.amount, 0, 1000000) && text(v.unit, 30);
const date = (value: unknown) =>
  text(value, 10) &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const url = (value: unknown) =>
  text(value, 2000) && (/^https?:\/\//.test(value) || /^\/(?!\/)/.test(value));
function optionalRecipe(v: Record<string, unknown>) {
  if (
    !['subtitle', 'tips', 'storage', 'menuKey', 'source', 'method', 'category'].every(
      (key) => v[key] === undefined || text(v[key], 10000),
    )
  )
    return false;
  if (
    !['calories', 'cost', 'prepTime', 'restTime'].every(
      (key) => v[key] === undefined || number(v[key], 0, 10000000),
    )
  )
    return false;
  if (v.photo !== undefined) {
    const p = v.photo;
    if (
      !object(p) ||
      !url(p.url) ||
      !['author', 'license'].every((key) => p[key] === undefined || text(p[key], 1000)) ||
      !['sourceUrl', 'licenseUrl'].every((key) => p[key] === undefined || url(p[key]))
    )
      return false;
  }
  if (v.video !== undefined) {
    const video = v.video;
    if (
      !object(video) ||
      !text(video.id, 200) ||
      !url(video.url) ||
      !text(video.title, 1000) ||
      !text(video.channel, 1000) ||
      (video.thumbnail !== undefined && !url(video.thumbnail)) ||
      !['views', 'likes', 'seconds'].every(
        (key) => video[key] === undefined || number(video[key], 0, Number.MAX_SAFE_INTEGER),
      )
    )
      return false;
  }
  return true;
}
export function parseBackup(raw: string): BackupData {
  if (raw.length > MAX_BACKUP_BYTES || utf8Size(raw) > MAX_BACKUP_BYTES)
    throw new Error('백업 파일은 5MB 이하여야 해요.');
  const fail = () => new Error('한끼 백업 파일의 형식이나 버전을 확인해주세요.');
  let backup: unknown;
  try {
    backup = JSON.parse(raw);
  } catch {
    throw fail();
  }
  if (!object(backup) || backup.format !== 'hankki' || backup.version !== 1 || !object(backup.data))
    throw fail();
  const data = backup.data,
    s = data.settings;
  if (
    !object(s) ||
    !strings(s.ingredients) ||
    !strings(s.pantry) ||
    !strings(s.excluded) ||
    !number(s.level, 0, 2) ||
    !Number.isInteger(s.level) ||
    !number(s.servings, 1, 6) ||
    !Number.isInteger(s.servings) ||
    !number(s.resultCount, 1, 12) ||
    !number(s.maxExtraIngredients, 0, 10) ||
    ![
      'all',
      'korean',
      'chinese',
      'japanese',
      'western',
      'asian',
      'snack',
      'fusion',
      'dessert',
      'other',
    ].includes(String(s.cuisine)) ||
    (s.diet !== undefined &&
      !['none', 'vegetarian', 'vegan', 'lowcal', 'highprotein'].includes(String(s.diet)))
  )
    throw fail();
  if (
    s.shopping !== undefined &&
    !list(
      s.shopping,
      (v) =>
        text(v.name, 80) &&
        (v.amount === undefined || text(v.amount, 80)) &&
        (v.recipe === undefined || text(v.recipe)) &&
        (v.checked === undefined || typeof v.checked === 'boolean'),
    )
  )
    throw fail();
  for (const stock of [s.stock, s.undoStock])
    if (
      stock !== undefined &&
      !list(
        stock,
        (v) =>
          text(v.name, 80) &&
          number(v.quantity, 0, 1000000) &&
          text(v.unit, 30) &&
          text(v.expires, 10) &&
          (!v.expires || date(v.expires)),
      )
    )
      throw fail();
  if (
    !text(data.nickname, 24) ||
    !list(
      data.logs,
      (v) =>
        text(v.id, 200) &&
        text(v.recipeId, 200) &&
        text(v.name, 200) &&
        date(v.date) &&
        number(v.servings, 1, 6) &&
        number(v.rating, 0, 5) &&
        Number.isInteger(v.rating) &&
        text(v.memo, 1000) &&
        (v.calories === undefined || number(v.calories, 0, 10000000)),
    )
  )
    throw fail();
  if (
    !list(
      data.saved,
      (v) =>
        text(v.id, 200) &&
        text(v.name, 200) &&
        number(v.time, 0, 10000) &&
        number(v.level, 0, 2) &&
        number(v.servings, 1, 6) &&
        text(v.reason, 10000) &&
        text(v.pair, 10000) &&
        optionalRecipe(v) &&
        list(v.ingredients, ingredient, 100) &&
        list(v.seasonings, ingredient, 100) &&
        list(
          v.steps,
          (step) =>
            text(step.title, 200) &&
            text(step.text, 20000) &&
            text(step.heat, 100) &&
            number(step.minutes, 0, 10000),
          100,
        ) &&
        strings(v.missing) &&
        (v.missingSeasonings === undefined || strings(v.missingSeasonings)) &&
        list(
          v.swaps,
          (swap) =>
            text(swap.original, 80) &&
            text(swap.name, 80) &&
            text(swap.note, 2000) &&
            (swap.amount === undefined || number(swap.amount, 0, 1000000)) &&
            (swap.unit === undefined || text(swap.unit, 30)),
          100,
        ) &&
        (v.allergens === undefined || strings(v.allergens)) &&
        (v.diet === undefined || strings(v.diet)) &&
        (v.tools === undefined ||
          list(v.tools, (tool) => text(tool.name, 80) && typeof tool.required === 'boolean', 100)),
    )
  )
    throw fail();
  return data as unknown as BackupData;
}
export function createBackup(data: BackupData) {
  const raw = JSON.stringify(
    { format: 'hankki', version: 1, exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
  parseBackup(raw);
  return raw;
}

/** Recover fields independently so one damaged setting cannot discard valid recipes. */
export function recoverLocalData(value: unknown, defaults: Settings): BackupData {
  const source = object(value) ? value : {};
  const settings: Settings = { ...defaults };
  const base: BackupData = { settings, saved: [], logs: [], nickname: '' };
  const valid = (data: BackupData) => {
    try {
      parseBackup(JSON.stringify({ format: 'hankki', version: 1, data }));
      return true;
    } catch {
      return false;
    }
  };
  if (object(source.settings)) {
    for (const key of [...Object.keys(defaults), 'shopping', 'stock', 'undoStock']) {
      if (!(key in source.settings)) continue;
      const candidate = { ...settings, [key]: source.settings[key] };
      if (valid({ ...base, settings: candidate })) Object.assign(settings, candidate);
    }
  }
  const saved = Array.isArray(source.saved)
    ? source.saved.filter((recipe) => valid({ ...base, saved: [recipe] }))
    : [];
  const logs = Array.isArray(source.logs)
    ? source.logs.filter((log) => valid({ ...base, logs: [log] }))
    : [];
  return { settings, saved, logs, nickname: text(source.nickname, 24) ? source.nickname : '' };
}
