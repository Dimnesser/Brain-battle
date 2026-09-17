/**
 * Система уровней NEXUS.
 * Порог первых уровней растёт вдвое (0 / 100 / 300 / 700 XP),
 * после 8-го уровня переходит в линейный рост — иначе прогресс встаёт.
 */

export const MAX_LEVEL = 60;

/** Сколько XP нужно, чтобы шагнуть с уровня (level - 1) на level. */
export function levelStep(level: number): number {
  if (level <= 1) return 0;
  if (level <= 8) return 100 * 2 ** (level - 2);
  return 6400 + (level - 8) * 3200;
}

/** Суммарный XP, необходимый для достижения уровня. */
export function xpForLevel(level: number): number {
  const target = Math.min(Math.max(level, 1), MAX_LEVEL);
  let total = 0;
  for (let l = 2; l <= target; l++) total += levelStep(l);
  return total;
}

/** Уровень, соответствующий накопленному XP. */
export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  percent: number;
  isMax: boolean;
}

/** Готовые данные для прогресс-бара уровня. */
export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const currentLevelXp = xpForLevel(level);
  const isMax = level >= MAX_LEVEL;
  const nextLevelXp = isMax ? currentLevelXp : xpForLevel(level + 1);
  const xpIntoLevel = xp - currentLevelXp;
  const xpForNextLevel = Math.max(nextLevelXp - currentLevelXp, 0);
  const percent = isMax ? 100 : Math.min(100, Math.round((xpIntoLevel / (xpForNextLevel || 1)) * 100));

  return { level, xp, currentLevelXp, nextLevelXp, xpIntoLevel, xpForNextLevel, percent, isMax };
}

/** Начисление XP за игровые действия. */
export const XP_RULES = {
  caseOpen: (price: number) => 5 + Math.floor(price / 10),
  dailyLogin: 25,
  referral: 100,
  deposit: (amount: number) => Math.floor(amount / 10),
  promo: 15,
} as const;

/** Название ранга — чисто косметика для профиля. */
export function levelTitle(level: number): string {
  if (level >= 50) return 'Легенда NEXUS';
  if (level >= 40) return 'Архитектор';
  if (level >= 30) return 'Оверлорд';
  if (level >= 20) return 'Киберпанк';
  if (level >= 12) return 'Хакер';
  if (level >= 6) return 'Рейдер';
  if (level >= 3) return 'Искатель';
  return 'Новичок';
}
