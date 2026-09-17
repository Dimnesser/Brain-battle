import { describe, expect, it } from 'vitest';
import { generateReferralCode, normalizeChances, pickRandom, weightedPick } from '../../src/lib/random.js';

describe('weightedPick', () => {
  it('никогда не возвращает награду с нулевым весом', () => {
    const items = [
      { id: 'zero', probability: 0 },
      { id: 'one', probability: 100 },
    ];

    for (let i = 0; i < 2000; i++) {
      expect(weightedPick(items).id).toBe('one');
    }
  });

  it('распределение сходится к заданным весам', () => {
    const items = [
      { id: 'common', probability: 70 },
      { id: 'rare', probability: 25 },
      { id: 'epic', probability: 5 },
    ];

    const counts: Record<string, number> = { common: 0, rare: 0, epic: 0 };
    const runs = 60_000;
    for (let i = 0; i < runs; i++) counts[weightedPick(items).id]! += 1;

    // Допуск 2 п.п. — статистический разброс на такой выборке заведомо меньше
    expect(Math.abs((counts.common! / runs) * 100 - 70)).toBeLessThan(2);
    expect(Math.abs((counts.rare! / runs) * 100 - 25)).toBeLessThan(2);
    expect(Math.abs((counts.epic! / runs) * 100 - 5)).toBeLessThan(2);
  });

  it('работает с весами, не дающими в сумме 100', () => {
    const items = [
      { id: 'a', probability: 3 },
      { id: 'b', probability: 1 },
    ];

    let a = 0;
    const runs = 40_000;
    for (let i = 0; i < runs; i++) if (weightedPick(items).id === 'a') a += 1;

    expect(Math.abs((a / runs) * 100 - 75)).toBeLessThan(2);
  });

  it('деградирует до равномерного выбора, если все веса нулевые', () => {
    const items = [
      { id: 'a', probability: 0 },
      { id: 'b', probability: 0 },
    ];
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(weightedPick(items).id);
    expect(seen.size).toBe(2);
  });

  it('падает на пустом списке, а не возвращает undefined', () => {
    expect(() => weightedPick([])).toThrow();
    expect(() => pickRandom([])).toThrow();
  });
});

describe('normalizeChances', () => {
  it('приводит произвольные веса к процентам', () => {
    const result = normalizeChances([
      { probability: 30 },
      { probability: 10 },
      { probability: 10 },
    ]);

    expect(result[0]!.chance).toBeCloseTo(60, 1);
    expect(result[1]!.chance).toBeCloseTo(20, 1);
    const sum = result.reduce((acc, item) => acc + item.chance, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it('не делит на ноль при пустых весах', () => {
    const result = normalizeChances([{ probability: 0 }]);
    expect(result[0]!.chance).toBe(0);
  });
});

describe('generateReferralCode', () => {
  it('состоит из безопасного алфавита без похожих символов', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateReferralCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it('практически не повторяется', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateReferralCode()));
    expect(codes.size).toBeGreaterThan(1990);
  });
});
