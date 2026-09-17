import { randomInt } from 'node:crypto';

export interface Weighted {
  probability: number;
}

/**
 * Взвешенный случайный выбор на криптостойком ГПСЧ.
 * Веса не обязаны давать в сумме 100 — они нормализуются.
 * Точность хранится через целые «тики», чтобы не накапливать ошибку float.
 */
export function weightedPick<T extends Weighted>(items: T[]): T {
  if (items.length === 0) throw new Error('weightedPick: пустой список наград');

  const TICKS = 1_000_000;
  const weights = items.map((item) => Math.max(0, Math.round(item.probability * TICKS)));
  const total = weights.reduce((sum, w) => sum + w, 0);

  // Все веса нулевые — деградируем до равномерного выбора, а не до падения
  if (total <= 0) return items[randomInt(items.length)]!;

  let roll = randomInt(total);
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/** Случайный элемент списка. */
export function pickRandom<T>(items: T[]): T {
  if (items.length === 0) throw new Error('pickRandom: пустой список');
  return items[randomInt(items.length)]!;
}

/** Реферальный код: короткий, читаемый, без похожих символов. */
export function generateReferralCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) code += alphabet[randomInt(alphabet.length)];
  return code;
}

/** Нормализация вероятностей кейса в проценты для отображения. */
export function normalizeChances<T extends Weighted>(items: T[]): Array<T & { chance: number }> {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.probability), 0);
  return items.map((item) => ({
    ...item,
    chance: total > 0 ? Number(((Math.max(0, item.probability) / total) * 100).toFixed(2)) : 0,
  }));
}
