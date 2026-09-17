import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';
import { errors } from '../errors.js';

export interface TelegramUserPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface ParsedInitData {
  user: TelegramUserPayload;
  authDate: Date;
  startParam?: string;
  queryId?: string;
}

/**
 * Проверка подписи Telegram WebApp initData.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Клиенту нельзя доверять ни одного поля: единственный источник личности —
 * HMAC-подпись, вычисленная по секрету бота.
 */
export function verifyInitData(initData: string): ParsedInitData {
  if (!env.BOT_TOKEN) throw errors.unauthorized('Проверка Telegram недоступна: не задан BOT_TOKEN');
  if (!initData) throw errors.unauthorized('Пустой initData');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw errors.unauthorized('initData без подписи');

  params.delete('hash');
  // signature присутствует у Ed25519-подписи третьей стороны и не участвует в HMAC
  params.delete('signature');

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (!safeEqualHex(computed, hash)) throw errors.unauthorized('Подпись Telegram не совпадает');

  const authDateRaw = params.get('auth_date');
  if (!authDateRaw || !/^\d+$/.test(authDateRaw)) throw errors.unauthorized('Некорректный auth_date');

  const authDate = new Date(Number(authDateRaw) * 1000);
  const ageSeconds = (Date.now() - authDate.getTime()) / 1000;
  if (ageSeconds > env.TELEGRAM_AUTH_TTL) throw errors.unauthorized('Сессия Telegram устарела, откройте приложение заново');
  // Небольшой запас на рассинхронизацию часов
  if (ageSeconds < -300) throw errors.unauthorized('Некорректное время авторизации');

  const userRaw = params.get('user');
  if (!userRaw) throw errors.unauthorized('initData не содержит пользователя');

  let user: TelegramUserPayload;
  try {
    user = JSON.parse(userRaw) as TelegramUserPayload;
  } catch {
    throw errors.unauthorized('Некорректные данные пользователя');
  }
  if (!user || typeof user.id !== 'number') throw errors.unauthorized('Некорректный Telegram ID');

  return {
    user,
    authDate,
    startParam: params.get('start_param') ?? undefined,
    queryId: params.get('query_id') ?? undefined,
  };
}

function safeEqualHex(a: string, b: string): boolean {
  // Сравнение постоянного времени: длины приводим хешированием
  const bufA = createHash('sha256').update(a).digest();
  const bufB = createHash('sha256').update(b).digest();
  return timingSafeEqual(bufA, bufB);
}
