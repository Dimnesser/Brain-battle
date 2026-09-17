import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';

/**
 * Полная очистка данных между тестами — состояние не перетекает между кейсами.
 * Перед TRUNCATE проверяем имя базы: случайный запуск тестов с рабочим
 * DATABASE_URL не должен стереть боевые данные.
 */
export async function resetDatabase(): Promise<void> {
  const [row] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (!row?.name?.includes('test')) {
    throw new Error(
      `Отказ очищать базу «${row?.name}»: тесты работают только с базой, в имени которой есть «test». ` +
        'Проверьте TEST_DATABASE_URL.',
    );
  }

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      admin_actions, notifications, referrals, bonus_claims,
      promo_code_uses, promo_codes, withdrawals, deposits,
      transactions, case_openings, case_rewards, cases, users
    RESTART IDENTITY CASCADE
  `);
}

export async function createApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

/** Кейс с предсказуемыми наградами: одна награда — детерминированный результат. */
export async function createCase(options: {
  slug?: string;
  price?: number;
  rewardAmount?: number;
  cooldownSeconds?: number | null;
  isActive?: boolean;
} = {}) {
  const {
    slug = 'test-case',
    price = 100,
    rewardAmount = 50,
    cooldownSeconds = null,
    isActive = true,
  } = options;

  return prisma.case.create({
    data: {
      slug,
      name: slug.toUpperCase(),
      image: '🎁',
      accent: 'violet',
      price,
      category: price === 0 ? 'FREE' : 'REGULAR',
      isActive,
      cooldownSeconds,
      rewards: {
        create: [{ name: `${rewardAmount} B`, amount: rewardAmount, image: '💎', rarity: 'COMMON', probability: 100 }],
      },
    },
    include: { rewards: true },
  });
}

/** Вход через dev-режим: возвращает токен и профиль. */
export async function login(
  app: FastifyInstance,
  telegramId: number,
  extra: { startParam?: string; devUsername?: string } = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/telegram',
    payload: { devTelegramId: telegramId, ...extra },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Не удалось авторизоваться: ${response.statusCode} ${response.body}`);
  }

  const body = response.json() as { token: string; user: { id: string; balance: number } };
  return { token: body.token, user: body.user, auth: { authorization: `Bearer ${body.token}` } };
}

export async function setBalance(userId: string, balance: number): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { balance } });
}
