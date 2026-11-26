import type { Settings } from './types.ts';

export function deduct(current: Settings, used: Record<string, number>) {
  const stock = current.stock || [];
  const consumed = stock.filter((item) => Object.hasOwn(used, item.name) && used[item.name]! > 0);
  if (!consumed.length || consumed.some((item) => used[item.name]! > item.quantity)) return current;
  const next = stock.map((item) =>
    consumed.includes(item)
      ? { ...item, quantity: Number((item.quantity - used[item.name]!).toFixed(3)) }
      : item,
  );
  return {
    ...current,
    stock: next.filter((item) => item.quantity > 0),
    undoStock: consumed,
    ingredients: current.ingredients.filter(
      (name) => !next.some((item) => item.name === name && item.quantity === 0),
    ),
  };
}
export function restore(current: Settings) {
  const previous = current.undoStock;
  if (!previous?.length) return current;
  return {
    ...current,
    stock: [
      ...(current.stock || []).filter((item) => !previous.some((old) => old.name === item.name)),
      ...previous,
    ],
    ingredients: [...new Set([...current.ingredients, ...previous.map((item) => item.name)])],
    undoStock: undefined,
  };
}
