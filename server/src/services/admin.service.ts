import type { Prisma } from '@prisma/client';
import type { AdminStatsDto, AdminUserDto, Paginated } from '@nexus/shared';
import { prisma } from '../db.js';
import { errors } from '../errors.js';
import { startOfUtcDay } from '../lib/time.js';
import { credit, debit } from './ledger.service.js';
import { notify } from './notification.service.js';

/** Аудит: каждое действие администратора фиксируется. */
export async function logAdminAction(
  adminId: string,
  action: string,
  target?: { type: string; id: string },
  payload?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.adminAction.create({
    data: {
      adminId,
      action,
      targetType: target?.type,
      targetId: target?.id,
      payload,
    },
  });
}

export async function getDashboard(): Promise<AdminStatsDto> {
  const today = startOfUtcDay();

  const [
    totalUsers,
    activeToday,
    newToday,
    banned,
    openings,
    openingsToday,
    wagerAgg,
    payoutAgg,
    depositAgg,
    depositTodayAgg,
    withdrawalPaidAgg,
    withdrawalPendingAgg,
    bonusAgg,
    promoAgg,
    referralAgg,
    topCasesRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastSeenAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.caseOpening.count(),
    prisma.caseOpening.count({ where: { createdAt: { gte: today } } }),
    prisma.caseOpening.aggregate({ _sum: { price: true } }),
    prisma.caseOpening.aggregate({ _sum: { amount: true } }),
    prisma.deposit.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    prisma.deposit.aggregate({ where: { status: 'PAID', paidAt: { gte: today } }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'BONUS' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'PROMO' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'REFERRAL' }, _sum: { amount: true } }),
    prisma.caseOpening.groupBy({
      by: ['caseId'],
      _count: { _all: true },
      _sum: { price: true, amount: true },
      orderBy: { _count: { caseId: 'desc' } },
      take: 5,
    }),
  ]);

  const caseIds = topCasesRaw.map((row) => row.caseId);
  const caseNames = await prisma.case.findMany({
    where: { id: { in: caseIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(caseNames.map((item) => [item.id, item.name]));

  const wagered = wagerAgg._sum.price ?? 0;
  const paidOut = payoutAgg._sum.amount ?? 0;

  return {
    users: { total: totalUsers, activeToday, newToday, banned },
    cases: {
      opened: openings,
      openedToday: openingsToday,
      wagered,
      paidOut,
      margin: wagered - paidOut,
    },
    finance: {
      deposits: depositAgg._sum.amount ?? 0,
      depositsToday: depositTodayAgg._sum.amount ?? 0,
      withdrawalsPaid: withdrawalPaidAgg._sum.amount ?? 0,
      withdrawalsPending: withdrawalPendingAgg._sum.amount ?? 0,
    },
    bonuses: {
      granted: bonusAgg._sum.amount ?? 0,
      promoGranted: promoAgg._sum.amount ?? 0,
      referralGranted: referralAgg._sum.amount ?? 0,
    },
    topCases: topCasesRaw.map((row) => ({
      id: row.caseId,
      name: nameById.get(row.caseId) ?? 'Кейс',
      opened: row._count._all,
      margin: (row._sum.price ?? 0) - (row._sum.amount ?? 0),
    })),
  };
}

export async function listUsers(params: {
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<AdminUserDto>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 100);
  const query = params.query?.trim();

  const where: Prisma.UserWhereInput = query
    ? {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { referralCode: { contains: query.toUpperCase() } },
          ...(/^\d+$/.test(query) ? [{ telegramId: BigInt(query) }] : []),
          ...(query.length > 20 ? [{ id: query }] : []),
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map((user) => ({
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      balance: user.balance,
      level: user.level,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      casesOpened: user.casesOpened,
      totalWon: user.totalWon,
      totalDeposited: user.totalDeposited,
      createdAt: user.createdAt.toISOString(),
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    })),
    total,
    page,
    pageSize,
  };
}

/** Ручная корректировка баланса. Всегда оставляет след в истории операций. */
export async function adjustBalance(
  adminId: string,
  userId: string,
  amount: number,
  reason: string,
): Promise<{ balance: number }> {
  if (!Number.isInteger(amount) || amount === 0) throw errors.validation('Сумма должна быть ненулевым целым числом');

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const mutation =
      amount > 0
        ? await credit(tx, {
            userId,
            amount,
            type: 'ADMIN_ADJUST',
            description: reason || 'Начисление администратором',
            metadata: { adminId },
          })
        : await debit(tx, {
            userId,
            amount: Math.abs(amount),
            type: 'ADMIN_ADJUST',
            description: reason || 'Списание администратором',
            metadata: { adminId },
          });

    await tx.adminAction.create({
      data: {
        adminId,
        action: 'user.balance',
        targetType: 'user',
        targetId: userId,
        payload: { amount, reason },
      },
    });

    await notify(
      {
        userId,
        type: 'SYSTEM',
        title: amount > 0 ? '💼 Начисление' : '💼 Корректировка',
        body: `${amount > 0 ? '+' : ''}${amount} B — ${reason || 'корректировка баланса'}`,
      },
      tx,
    );

    return mutation;
  });

  return { balance: result.balance };
}

export async function setBanned(
  adminId: string,
  userId: string,
  isBanned: boolean,
  reason?: string,
): Promise<AdminUserDto> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isBanned, banReason: isBanned ? reason ?? null : null },
  });

  await logAdminAction(adminId, isBanned ? 'user.ban' : 'user.unban', { type: 'user', id: userId }, {
    reason: reason ?? null,
  });

  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    balance: user.balance,
    level: user.level,
    isAdmin: user.isAdmin,
    isBanned: user.isBanned,
    casesOpened: user.casesOpened,
    totalWon: user.totalWon,
    totalDeposited: user.totalDeposited,
    createdAt: user.createdAt.toISOString(),
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
  };
}
