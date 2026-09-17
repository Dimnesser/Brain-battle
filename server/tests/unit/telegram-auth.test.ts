import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyInitData } from '../../src/auth/telegram.js';

const BOT_TOKEN = '123456:TEST-BOT-TOKEN-FOR-SIGNATURE-CHECKS';

/** Собирает initData с корректной подписью — как это делает Telegram. */
function signInitData(params: Record<string, string>): string {
  const dataCheckString = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const search = new URLSearchParams({ ...params, hash });
  return search.toString();
}

const user = JSON.stringify({ id: 777001, first_name: 'Тест', username: 'tester' });

describe('verifyInitData', () => {
  it('принимает корректно подписанные данные', () => {
    const initData = signInitData({
      user,
      auth_date: Math.floor(Date.now() / 1000).toString(),
      query_id: 'AAA',
    });

    const parsed = verifyInitData(initData);
    expect(parsed.user.id).toBe(777001);
    expect(parsed.user.username).toBe('tester');
  });

  it('отклоняет подделанный хеш', () => {
    const initData = signInitData({ user, auth_date: Math.floor(Date.now() / 1000).toString() });
    const tampered = initData.replace(/hash=[a-f0-9]+/, 'hash=' + 'f'.repeat(64));
    expect(() => verifyInitData(tampered)).toThrow();
  });

  it('отклоняет подмену пользователя при сохранённой подписи', () => {
    const initData = signInitData({ user, auth_date: Math.floor(Date.now() / 1000).toString() });
    // Пытаемся выдать себя за другого игрока, оставив чужую подпись
    const attack = initData.replace(encodeURIComponent('777001'), encodeURIComponent('777002'));
    expect(() => verifyInitData(attack)).toThrow();
  });

  it('отклоняет просроченный auth_date', () => {
    const old = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
    const initData = signInitData({ user, auth_date: old.toString() });
    expect(() => verifyInitData(initData)).toThrow(/устарел/i);
  });

  it('отклоняет auth_date из будущего', () => {
    const future = Math.floor(Date.now() / 1000) + 60 * 60;
    const initData = signInitData({ user, auth_date: future.toString() });
    expect(() => verifyInitData(initData)).toThrow();
  });

  it('отклоняет данные без подписи и без пользователя', () => {
    expect(() => verifyInitData('')).toThrow();
    expect(() => verifyInitData('user=' + encodeURIComponent(user))).toThrow(/подпис/i);
    expect(() => verifyInitData(signInitData({ auth_date: Math.floor(Date.now() / 1000).toString() }))).toThrow(
      /пользовател/i,
    );
  });

  it('игнорирует поле signature при проверке HMAC', () => {
    // Telegram добавляет Ed25519-подпись, которая не входит в data_check_string
    const base = signInitData({ user, auth_date: Math.floor(Date.now() / 1000).toString() });
    const withSignature = `${base}&signature=abc123`;
    expect(() => verifyInitData(withSignature)).not.toThrow();
  });
});
