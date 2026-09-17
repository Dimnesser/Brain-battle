import { env } from './env.js';

export interface EnsureUserResult {
  user: {
    id: string;
    balance: number;
    level: number;
    levelTitle: string;
    referralCode: string;
    stats: { casesOpened: number; totalWon: number; referrals: number; loginStreak: number };
  };
  created: boolean;
  startBonus: number;
  streak: number;
}

/**
 * Клиент внутреннего API.
 * Регистрацию и начисление бонусов делает сервер — бот не дублирует
 * бизнес-логику и не пишет в баланс напрямую.
 */
export async function ensureUser(params: {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  startParam?: string;
}): Promise<EnsureUserResult> {
  const response = await fetch(`${env.API_URL.replace(/\/$/, '')}/api/internal/users/ensure`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': env.INTERNAL_API_TOKEN,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Внутренний API вернул ${response.status}: ${text.slice(0, 200)}`);
  }

  return (await response.json()) as EnsureUserResult;
}
