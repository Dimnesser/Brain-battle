import { describe, expect, it } from 'vitest';
import { displayName, formatCoins, formatCompact, formatCountdown, maskRequisites } from '../src/format.js';

describe('formatCoins', () => {
  it('разделяет разряды неразрывным пробелом', () => {
    expect(formatCoins(1250)).toBe('1 250');
    expect(formatCoins(1_000_000)).toBe('1 000 000');
    expect(formatCoins(999)).toBe('999');
    expect(formatCoins(0)).toBe('0');
  });

  it('сохраняет знак отрицательных значений', () => {
    expect(formatCoins(-1500)).toBe('-1 500');
  });
});

describe('formatCompact', () => {
  it('сокращает крупные числа', () => {
    expect(formatCompact(12_500)).toBe('12.5K');
    expect(formatCompact(2_000_000)).toBe('2M');
    expect(formatCompact(9999)).toBe('9 999');
  });
});

describe('formatCountdown', () => {
  it('форматирует секунды как ЧЧ:ММ:СС', () => {
    expect(formatCountdown(6138)).toBe('01:42:18');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(59)).toBe('00:00:59');
  });

  it('не показывает отрицательное время', () => {
    expect(formatCountdown(-100)).toBe('00:00:00');
  });
});

describe('displayName', () => {
  it('предпочитает username, затем имя, затем заглушку', () => {
    expect(displayName({ username: 'neo', firstName: 'Томас' })).toBe('@neo');
    expect(displayName({ username: null, firstName: 'Томас' })).toBe('Томас');
    expect(displayName({ username: null, firstName: null })).toBe('Игрок');
  });
});

describe('maskRequisites', () => {
  it('скрывает середину реквизитов', () => {
    expect(maskRequisites('2200000000001234')).toBe('22••••1234');
    expect(maskRequisites('123')).toBe('••••');
  });

  it('не раскрывает больше 6 символов исходной строки', () => {
    const card = '4276111122223333';
    const masked = maskRequisites(card);
    const visible = masked.replace(/•/g, '');
    expect(visible.length).toBeLessThanOrEqual(6);
    expect(masked).not.toContain('111122');
  });
});
