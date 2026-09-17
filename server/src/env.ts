import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// .env лежит в корне монорепозитория
loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../.env') });

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),

  BOT_TOKEN: z.string().default(''),
  BOT_USERNAME: z.string().default('nexus_bot'),
  WEBAPP_URL: z.string().default('http://localhost:5173'),
  SUBSCRIPTION_CHANNEL: z.string().default(''),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET должен быть длиннее 16 символов'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  TELEGRAM_AUTH_TTL: z.coerce.number().int().positive().default(86_400),
  ALLOW_DEV_AUTH: booleanish.default(false),

  ADMIN_TELEGRAM_ID: z.string().default(''),
  INTERNAL_API_TOKEN: z.string().default(''),
  CORS_ORIGIN: z.string().default('*'),

  PAYMENT_PROVIDER: z.string().default('mock'),
  PAYMENT_SECRET: z.string().default('dev_payment_secret'),
  TELEGRAM_PROVIDER_TOKEN: z.string().default(''),
  COINS_PER_CURRENCY_UNIT: z.coerce.number().positive().default(1),
  PAYMENT_CURRENCY: z.string().default('RUB'),

  START_BONUS: z.coerce.number().int().nonnegative().default(250),
  REFERRER_BONUS: z.coerce.number().int().nonnegative().default(150),
  REFEREE_BONUS: z.coerce.number().int().nonnegative().default(100),
  DAILY_BONUS_BASE: z.coerce.number().int().nonnegative().default(50),
  WITHDRAWAL_MIN: z.coerce.number().int().positive().default(1000),
  WITHDRAWAL_FEE_PERCENT: z.coerce.number().min(0).max(50).default(5),
  BIG_WIN_THRESHOLD: z.coerce.number().int().positive().default(1000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  // Падаем сразу: работать с половиной конфигурации опаснее, чем не стартовать
  throw new Error(`Некорректная конфигурация окружения:\n${issues}\n\nСкопируйте .env.example в .env и заполните значения.`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

/** Telegram ID администраторов из ADMIN_TELEGRAM_ID (через запятую). */
export const adminTelegramIds: bigint[] = env.ADMIN_TELEGRAM_ID.split(',')
  .map((v) => v.trim())
  .filter((v) => /^\d+$/.test(v))
  .map((v) => BigInt(v));

export const corsOrigins: string[] | true =
  env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((v) => v.trim()).filter(Boolean);

// Прод без валидного initData — прямой путь к подделке пользователей
if (isProduction && env.ALLOW_DEV_AUTH) {
  throw new Error('ALLOW_DEV_AUTH нельзя включать в production: вход без Telegram позволит подделать любого пользователя.');
}
if (isProduction && !env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN обязателен в production — без него невозможно проверить Telegram initData.');
}
