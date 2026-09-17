import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BOT_TOKEN: z.string().min(10, 'BOT_TOKEN обязателен для запуска бота'),
  BOT_USERNAME: z.string().default('nexus_bot'),
  WEBAPP_URL: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  API_URL: z.string().default('http://localhost:4000'),
  INTERNAL_API_TOKEN: z.string().default(''),
  ADMIN_TELEGRAM_ID: z.string().default(''),
  SUBSCRIPTION_CHANNEL: z.string().default(''),
  NOTIFY_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Некорректная конфигурация бота:\n${issues}\n\nЗаполните .env по образцу .env.example.`);
}

export const env = parsed.data;

export const adminIds = env.ADMIN_TELEGRAM_ID.split(',')
  .map((v) => v.trim())
  .filter((v) => /^\d+$/.test(v));
