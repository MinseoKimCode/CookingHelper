import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'hankki.community.ownership.v1';
let pending = Promise.resolve();
export async function loadOwnership(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.entries(value).some(
      ([key, token]) =>
        key.length > 200 || typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token),
    )
  )
    throw new Error('작성 권한 데이터를 읽지 못했어요.');
  return value as Record<string, string>;
}
export function rememberOwnership(id: string, token: string) {
  const operation = pending.then(async () => {
    const current = await loadOwnership();
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, [id]: token }));
  });
  pending = operation.catch(() => undefined);
  return operation;
}
