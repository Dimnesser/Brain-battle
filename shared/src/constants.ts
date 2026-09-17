/** Общие константы интерфейса и экономики. */

export const CURRENCY = 'B';
export const APP_NAME = 'NEXUS';
export const APP_TAGLINE = 'PLAY • OPEN • WIN';

export const DEPOSIT_PRESETS = [100, 500, 1000, 5000] as const;
export const DEPOSIT_MIN = 50;
export const DEPOSIT_MAX = 500_000;
export const WITHDRAWAL_METHODS = [
  { id: 'card', label: 'Банковская карта', placeholder: '2200 0000 0000 0000' },
  { id: 'sbp', label: 'СБП по номеру', placeholder: '+7 900 000-00-00' },
  { id: 'crypto', label: 'USDT (TRC-20)', placeholder: 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
] as const;

export const STREAK_TARGET = 7;
export const STREAK_REWARDS = [50, 75, 100, 150, 200, 250, 500] as const;
export const FREE_CASE_COOLDOWN_SECONDS = 24 * 60 * 60;

export const RARITY_ORDER: Record<string, number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3,
  MYTHIC: 4,
};

export const RARITY_LABELS: Record<string, string> = {
  COMMON: 'Обычная',
  RARE: 'Редкая',
  EPIC: 'Эпическая',
  LEGENDARY: 'Легендарная',
  MYTHIC: 'Мифическая',
};

export const CATEGORY_LABELS: Record<string, string> = {
  POPULAR: '🔥 Популярные',
  PREMIUM: '💎 Дорогие',
  REGULAR: '🎲 Обычные',
  FREE: '🆓 Бесплатные',
};

export const TRANSACTION_LABELS: Record<string, string> = {
  DEPOSIT: 'Пополнение',
  WITHDRAWAL: 'Вывод',
  WITHDRAWAL_REFUND: 'Возврат вывода',
  CASE_PURCHASE: 'Открытие кейса',
  CASE_REWARD: 'Выигрыш',
  BONUS: 'Бонус',
  PROMO: 'Промокод',
  REFERRAL: 'Реферальный бонус',
  ADMIN_ADJUST: 'Корректировка',
};

/** Коды ошибок API — клиент переводит их в понятный текст. */
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  CASE_INACTIVE: 'CASE_INACTIVE',
  COOLDOWN: 'COOLDOWN',
  ALREADY_CLAIMED: 'ALREADY_CLAIMED',
  PROMO_INVALID: 'PROMO_INVALID',
  PROMO_EXPIRED: 'PROMO_EXPIRED',
  PROMO_LIMIT: 'PROMO_LIMIT',
  PROMO_USED: 'PROMO_USED',
  BANNED: 'BANNED',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Человеческие тексты ошибок для интерфейса. */
export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Нужно войти заново',
  FORBIDDEN: 'Недостаточно прав',
  NOT_FOUND: 'Не найдено',
  VALIDATION: 'Проверьте введённые данные',
  INSUFFICIENT_FUNDS: 'Недостаточно средств',
  CASE_INACTIVE: 'Кейс недоступен',
  COOLDOWN: 'Ещё не время — подождите',
  ALREADY_CLAIMED: 'Уже получено',
  PROMO_INVALID: 'Промокод не найден',
  PROMO_EXPIRED: 'Срок действия промокода истёк',
  PROMO_LIMIT: 'Лимит активаций исчерпан',
  PROMO_USED: 'Вы уже активировали этот промокод',
  BANNED: 'Аккаунт заблокирован',
  RATE_LIMIT: 'Слишком часто. Попробуйте позже',
  INTERNAL: 'Что-то пошло не так',
};
