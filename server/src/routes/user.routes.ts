import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { TRANSACTION_LABELS, type TransactionDto } from '@nexus/shared';
import { prisma } from '../db.js';
import { auth, requireAuth } from '../plugins/auth.js';
import { toUserDto } from '../services/user.service.js';
import { userOpenings } from '../services/case.service.js';
import { listNotifications, markAllRead } from '../services/notification.service.js';

const historyQuery = z.object({
  type: z
    .enum(['ALL', 'DEPOSIT', 'WITHDRAWAL', 'CASE_REWARD', 'CASE_PURCHASE', 'BONUS', 'PROMO', 'REFERRAL'])
    .default('ALL'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** История операций игрока — используется двумя маршрутами. */
async function transactionsHandler(request: FastifyRequest): Promise<{ items: TransactionDto[] }> {
  const { userId } = auth(request);
  const query = historyQuery.parse(request.query ?? {});

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      ...(query.type === 'ALL' ? {} : { type: query.type }),
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });

  const items: TransactionDto[] = transactions.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amount: transaction.amount,
    balanceAfter: transaction.balanceAfter,
    description: transaction.description ?? TRANSACTION_LABELS[transaction.type] ?? null,
    createdAt: transaction.createdAt.toISOString(),
  }));

  return { items };
}

/** Короткий маршрут /api/transactions — тот же обработчик, что и /api/user/transactions. */
export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  app.get('/', transactionsHandler);
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth(request).userId } });
    return { user: await toUserDto(user) };
  });

  app.get('/transactions', transactionsHandler);

  app.get('/openings', async (request) => {
    const { userId } = auth(request);
    const openings = await userOpenings(userId, 40);
    return {
      items: openings.map((opening) => ({
        id: opening.id,
        caseName: opening.case.name,
        caseImage: opening.case.image,
        rewardName: opening.reward.name,
        rewardImage: opening.reward.image,
        rarity: opening.reward.rarity,
        price: opening.price,
        amount: opening.amount,
        profit: opening.profit,
        createdAt: opening.createdAt.toISOString(),
      })),
    };
  });

  app.get('/notifications', async (request) => {
    const items = await listNotifications(auth(request).userId);
    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        isRead: item.isRead,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  });

  app.post('/notifications/read', async (request) => {
    const count = await markAllRead(auth(request).userId);
    return { updated: count };
  });
}
