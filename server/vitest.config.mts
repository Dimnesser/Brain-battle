import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    // Интеграционные тесты делят одну базу — параллельные файлы её перетрут
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Конфигурация задаётся здесь, чтобы попасть в process.env до импорта env.ts
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus_test?schema=public',
      JWT_SECRET: 'test_secret_test_secret_test_secret_123456',
      JWT_EXPIRES_IN: '1h',
      ALLOW_DEV_AUTH: 'true',
      ADMIN_TELEGRAM_ID: '900000001',
      INTERNAL_API_TOKEN: 'test_internal_token',
      PAYMENT_PROVIDER: 'mock',
      PAYMENT_SECRET: 'test_payment_secret',
      BOT_TOKEN: '123456:TEST-BOT-TOKEN-FOR-SIGNATURE-CHECKS',
      BOT_USERNAME: 'nexus_test_bot',
      WEBAPP_URL: 'http://localhost:5173',
      LOG_LEVEL: 'silent',
      START_BONUS: '250',
      REFERRER_BONUS: '150',
      REFEREE_BONUS: '100',
      DAILY_BONUS_BASE: '50',
      WITHDRAWAL_MIN: '1000',
      WITHDRAWAL_FEE_PERCENT: '5',
      BIG_WIN_THRESHOLD: '1000',
    },
  },
});
