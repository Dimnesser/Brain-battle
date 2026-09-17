import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, levelFromXp, levelProgress, levelTitle, xpForLevel } from '../src/levels.js';

describe('пороги уровней', () => {
  it('соответствуют заявленной прогрессии 0 / 100 / 300 / 700', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(xpForLevel(4)).toBe(700);
  });

  it('строго возрастают до максимального уровня', () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(xpForLevel(level)).toBeGreaterThan(xpForLevel(level - 1));
    }
  });

  it('не уходят в бесконечность: 60-й уровень достижим за разумный XP', () => {
    // Удвоение на всех уровнях дало бы астрономическое число — проверяем,
    // что рост переходит в линейный
    expect(xpForLevel(MAX_LEVEL)).toBeLessThan(6_000_000);
  });
});

describe('levelFromXp', () => {
  it('определяет уровень по накопленному XP', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(299)).toBe(2);
    expect(levelFromXp(300)).toBe(3);
    expect(levelFromXp(700)).toBe(4);
  });

  it('не превышает максимальный уровень при любом XP', () => {
    expect(levelFromXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
  });

  it('согласован с xpForLevel на каждом пороге', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(levelFromXp(xpForLevel(level))).toBe(level);
      if (level > 1) expect(levelFromXp(xpForLevel(level) - 1)).toBe(level - 1);
    }
  });
});

describe('levelProgress', () => {
  it('считает прогресс внутри уровня', () => {
    const progress = levelProgress(200);
    expect(progress.level).toBe(2);
    expect(progress.xpIntoLevel).toBe(100);
    expect(progress.xpForNextLevel).toBe(200);
    expect(progress.percent).toBe(50);
    expect(progress.isMax).toBe(false);
  });

  it('на максимальном уровне отдаёт 100% и флаг isMax', () => {
    const progress = levelProgress(xpForLevel(MAX_LEVEL));
    expect(progress.isMax).toBe(true);
    expect(progress.percent).toBe(100);
  });

  it('никогда не выходит за пределы 0–100%', () => {
    for (const xp of [0, 1, 99, 100, 5000, 1_000_000, 50_000_000]) {
      const progress = levelProgress(xp);
      expect(progress.percent).toBeGreaterThanOrEqual(0);
      expect(progress.percent).toBeLessThanOrEqual(100);
    }
  });
});

describe('levelTitle', () => {
  it('выдаёт ранг для каждого уровня', () => {
    expect(levelTitle(1)).toBe('Новичок');
    expect(levelTitle(50)).toBe('Легенда NEXUS');
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(levelTitle(level).length).toBeGreaterThan(0);
    }
  });
});
