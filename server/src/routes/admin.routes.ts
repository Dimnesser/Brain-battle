import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { auth, requireAdmin } from '../plugins/auth.js';
import { adjustBalance, getDashboard, listUsers, logAdminAction, setBanned } from '../services/admin.service.js';
import { createPromo } from '../services/promo.service.js';
import { approveWithdrawal, rejectWithdrawal, toWithdrawalDto } from '../services/withdrawal.service.js';

const idParam = z.object({ id: z.string().min(1).max(64) });

const rewardSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(64),
  amount: z.number().int().min(0),
  image: z.string().max(32).default('💎'),
  rarity: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC']).default('COMMON'),
  probability: z.number().min(0).max(100),
});

const caseSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, 'Только строчные латинские буквы, цифры и дефис'),
  name: z.string().min(2).max(64),
  description: z.string().max(240).optional(),
  image: z.string().max(32).default('⚡'),
  accent: z.string().max(24).default('violet'),
  price: z.number().int().min(0),
  category: z.enum(['POPULAR', 'PREMIUM', 'REGULAR', 'FREE']).default('REGULAR'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  cooldownSeconds: z.number().int().positive().nullable().optional(),
  rewards: z.array(rewardSchema).min(1, 'Нужна хотя бы одна награда'),
});

const casePatchSchema = caseSchema.partial();

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Все маршруты ниже доступны только администраторам
  app.addHook('preHandler', requireAdmin);

  app.get('/stats', async () => getDashboard());

  // ── Пользователи ──────────────────────────
  app.get('/users', async (request) => {
    const query = z
      .object({
        query: z.string().max(64).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(request.query ?? {});
    return listUsers(query);
  });

  app.post('/users/:id/balance', async (request) => {
    const { id } = idParam.parse(request.params);
    const body = z
      .object({ amount: z.number().int(), reason: z.string().max(200).default('') })
      .parse(request.body ?? {});

    const { userId } = auth(request);
    const result = await adjustBalance(userId, id, body.amount, body.reason);
    request.log.warn({ adminId: userId, targetId: id, amount: body.amount }, 'админ изменил баланс');
    return result;
  });

  app.post('/users/:id/ban', async (request) => {
    const { id } = idParam.parse(request.params);
    const body = z
      .object({ isBanned: z.boolean(), reason: z.string().max(200).optional() })
      .parse(request.body ?? {});

    const { userId } = auth(request);
    const user = await setBanned(userId, id, body.isBanned, body.reason);
    request.log.warn({ adminId: userId, targetId: id, isBanned: body.isBanned }, 'админ изменил статус игрока');
    return { user };
  });

  // ── Кейсы ─────────────────────────────────
  app.get('/cases', async () => {
    const items = await prisma.case.findMany({
      include: { rewards: { orderBy: { amount: 'asc' } }, _count: { select: { openings: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        description: item.description,
        image: item.image,
        accent: item.accent,
        price: item.price,
        category: item.category,
        isActive: item.isActive,
        sortOrder: item.sortOrder,
        cooldownSeconds: item.cooldownSeconds,
        opened: item._count.openings,
        rewards: item.rewards.map((reward) => ({
          id: reward.id,
          name: reward.name,
          amount: reward.amount,
          image: reward.image,
          rarity: reward.rarity,
          probability: reward.probability,
        })),
      })),
    };
  });

  app.post('/cases', async (request) => {
    const body = caseSchema.parse(request.body ?? {});
    const { userId } = auth(request);

    const created = await prisma.case.create({
      data: {
        slug: body.slug,
        name: body.name,
        description: body.description,
        image: body.image,
        accent: body.accent,
        price: body.price,
        category: body.category,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
        cooldownSeconds: body.cooldownSeconds ?? null,
        rewards: {
          create: body.rewards.map((reward) => ({
            name: reward.name,
            amount: reward.amount,
            image: reward.image,
            rarity: reward.rarity,
            probability: reward.probability,
          })),
        },
      },
      include: { rewards: true },
    });

    await logAdminAction(userId, 'case.create', { type: 'case', id: created.id }, { slug: created.slug });
    return { case: created };
  });

  app.patch('/cases/:id', async (request) => {
    const { id } = idParam.parse(request.params);
    const body = casePatchSchema.parse(request.body ?? {});
    const { userId } = auth(request);

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.case.update({
        where: { id },
        data: {
          slug: body.slug,
          name: body.name,
          description: body.description,
          image: body.image,
          accent: body.accent,
          price: body.price,
          category: body.category,
          isActive: body.isActive,
          sortOrder: body.sortOrder,
          cooldownSeconds: body.cooldownSeconds,
        },
      });

      // Награды присланы целиком — заменяем набор, чтобы вероятности
      // не «разъехались» между старыми и новыми записями
      if (body.rewards) {
        await tx.caseReward.deleteMany({ where: { caseId: id } });
        await tx.caseReward.createMany({
          data: body.rewards.map((reward) => ({
            caseId: id,
            name: reward.name,
            amount: reward.amount,
            image: reward.image,
            rarity: reward.rarity,
            probability: reward.probability,
          })),
        });
      }

      return tx.case.findUniqueOrThrow({ where: { id: item.id }, include: { rewards: true } });
    });

    await logAdminAction(userId, 'case.update', { type: 'case', id }, { fields: Object.keys(body) });
    return { case: updated };
  });

  app.delete('/cases/:id', async (request) => {
    const { id } = idParam.parse(request.params);
    const { userId } = auth(request);
    // Кейс не удаляем: с ним связана история открытий — только выключаем
    const item = await prisma.case.update({ where: { id }, data: { isActive: false } });
    await logAdminAction(userId, 'case.disable', { type: 'case', id });
    return { case: item };
  });

  // ── Промокоды ─────────────────────────────
  app.get('/promocodes', async () => {
    const items = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { uses: true } } },
    });
    return {
      items: items.map((promo) => ({
        id: promo.id,
        code: promo.code,
        type: promo.type,
        amount: promo.amount,
        maxActivations: promo.maxActivations,
        activations: promo.activations,
        perUserLimit: promo.perUserLimit,
        expiresAt: promo.expiresAt?.toISOString() ?? null,
        isActive: promo.isActive,
        description: promo.description,
        uses: promo._count.uses,
        createdAt: promo.createdAt.toISOString(),
      })),
    };
  });

  app.post('/promocodes', async (request) => {
    const body = z
      .object({
        code: z.string().min(3).max(32),
        type: z.enum(['BALANCE', 'DEPOSIT_PERCENT', 'XP']).default('BALANCE'),
        amount: z.number().int().min(1),
        maxActivations: z.number().int().positive().nullable().optional(),
        perUserLimit: z.number().int().min(1).max(100).default(1),
        expiresAt: z.string().datetime().nullable().optional(),
        description: z.string().max(200).nullable().optional(),
      })
      .parse(request.body ?? {});

    const { userId } = auth(request);
    const promo = await createPromo({
      ...body,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });

    await logAdminAction(userId, 'promo.create', { type: 'promo', id: promo.id }, { code: promo.code });
    return { promo };
  });

  app.patch('/promocodes/:id', async (request) => {
    const { id } = idParam.parse(request.params);
    const body = z
      .object({ isActive: z.boolean().optional(), maxActivations: z.number().int().positive().nullable().optional() })
      .parse(request.body ?? {});

    const { userId } = auth(request);
    const promo = await prisma.promoCode.update({ where: { id }, data: body });
    await logAdminAction(userId, 'promo.update', { type: 'promo', id }, body);
    return { promo };
  });

  // ── Финансы ───────────────────────────────
  app.get('/deposits', async (request) => {
    const query = z
      .object({ status: z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED']).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) })
      .parse(request.query ?? {});

    const items = await prisma.deposit.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      include: { user: { select: { id: true, username: true, firstName: true, telegramId: true } } },
    });

    return {
      items: items.map((deposit) => ({
        id: deposit.id,
        amount: deposit.amount,
        bonusAmount: deposit.bonusAmount,
        status: deposit.status,
        provider: deposit.provider,
        createdAt: deposit.createdAt.toISOString(),
        paidAt: deposit.paidAt?.toISOString() ?? null,
        user: {
          id: deposit.user.id,
          name: deposit.user.username ?? deposit.user.firstName ?? 'Игрок',
          telegramId: deposit.user.telegramId.toString(),
        },
      })),
    };
  });

  app.get('/withdrawals', async (request) => {
    const query = z
      .object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) })
      .parse(request.query ?? {});

    const items = await prisma.withdrawal.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      include: { user: { select: { id: true, username: true, firstName: true, telegramId: true } } },
    });

    return {
      items: items.map((withdrawal) => ({
        ...toWithdrawalDto(withdrawal),
        // Полные реквизиты нужны для выплаты — их видит только админ-API
        requisitesFull: withdrawal.requisites,
        user: {
          id: withdrawal.user.id,
          name: withdrawal.user.username ?? withdrawal.user.firstName ?? 'Игрок',
          telegramId: withdrawal.user.telegramId.toString(),
        },
      })),
    };
  });

  app.post('/withdrawals/:id/approve', async (request) => {
    const { id } = idParam.parse(request.params);
    const body = z.object({ comment: z.string().max(200).optional() }).parse(request.body ?? {});
    const { userId } = auth(request);

    const withdrawal = await approveWithdrawal(id, userId, body.comment);
    request.log.warn({ adminId: userId, withdrawalId: id }, 'вывод одобрен');
    return { withdrawal };
  });

  app.post('/withdrawals/:id/reject', async (request) => {
    const { id } = idParam.parse(request.params);
    const body = z.object({ comment: z.string().max(200).optional() }).parse(request.body ?? {});
    const { userId } = auth(request);

    const withdrawal = await rejectWithdrawal(id, userId, body.comment);
    request.log.warn({ adminId: userId, withdrawalId: id }, 'вывод отклонён');
    return { withdrawal };
  });

  app.get('/actions', async () => {
    const items = await prisma.adminAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { admin: { select: { username: true, firstName: true } } },
    });
    return {
      items: items.map((action) => ({
        id: action.id,
        action: action.action,
        targetType: action.targetType,
        targetId: action.targetId,
        payload: action.payload,
        admin: action.admin.username ?? action.admin.firstName ?? 'admin',
        createdAt: action.createdAt.toISOString(),
      })),
    };
  });
}
