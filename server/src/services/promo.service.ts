import { Prisma } from '@prisma/client';
import { XP_RULES, type PromoRedeemResult } from '@nexus/shared';
import { prisma } from '../db.js';
import { errors } from '../errors.js';
import { credit } from './ledger.service.js';

/** Активация промокода. Все лимиты проверяются в транзакции, а не на клиенте. */
export async function redeemPromo(userId: string, rawCode: string): Promise<PromoRedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw errors.validation('Некорректный формат промокода');

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { isBanned: true, balance: true },
  });
  if (user.isBanned) throw errors.banned();

  return prisma.$transaction(async (tx) => {
    // Блокируем игрока: параллельные активации одного кода выстроятся в очередь
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const promo = await tx.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.isActive) throw errors.validation('Промокод не найден');
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      throw errors.validation('Срок действия промокода истёк');
    }
    if (promo.maxActivations !== null && promo.activations >= promo.maxActivations) {
      throw errors.validation('Лимит активаций промокода исчерпан');
    }

    const usedByUser = await tx.promoCodeUse.count({ where: { promoCodeId: promo.id, userId } });
    if (usedByUser >= promo.perUserLimit) throw errors.alreadyClaimed('Вы уже активировали этот промокод');

    // Условный UPDATE: счётчик не уйдёт за максимум при гонке
    const claimed = await tx.promoCode.updateMany({
      where: {
        id: promo.id,
        isActive: true,
        OR: [{ maxActivations: null }, { maxActivations: { gt: promo.activations } }],
        activations: promo.activations,
      },
      data: { activations: { increment: 1 } },
    });
    if (claimed.count === 0) throw errors.validation('Промокод уже использован, попробуйте ещё раз');

    await tx.promoCodeUse.create({ data: { promoCodeId: promo.id, userId, amount: promo.amount } });

    if (promo.type === 'BALANCE') {
      const result = await credit(tx, {
        userId,
        amount: promo.amount,
        type: 'PROMO',
        description: `Промокод ${promo.code}`,
        metadata: { promoId: promo.id, code: promo.code },
        xp: XP_RULES.promo,
      });
      return {
        code: promo.code,
        type: promo.type,
        amount: promo.amount,
        balance: result.balance,
        message: `Промокод активирован: +${promo.amount} B`,
      };
    }

    if (promo.type === 'XP') {
      const result = await credit(tx, {
        userId,
        amount: 0,
        type: 'PROMO',
        description: `Промокод ${promo.code} (+${promo.amount} XP)`,
        metadata: { promoId: promo.id, code: promo.code },
        xp: promo.amount,
      });
      return {
        code: promo.code,
        type: promo.type,
        amount: promo.amount,
        balance: result.balance,
        message: `Промокод активирован: +${promo.amount} XP`,
      };
    }

    // DEPOSIT_PERCENT — бонус применится при следующем пополнении
    const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } });
    await tx.transaction.create({
      data: {
        userId,
        type: 'PROMO',
        status: 'COMPLETED',
        amount: 0,
        balanceAfter: current.balance,
        description: `Промокод ${promo.code}: +${promo.amount}% к пополнению`,
        metadata: { promoId: promo.id, code: promo.code, depositPercent: promo.amount },
      },
    });

    return {
      code: promo.code,
      type: promo.type,
      amount: promo.amount,
      balance: current.balance,
      message: `+${promo.amount}% будет начислено при следующем пополнении`,
    };
  });
}

/**
 * Активный бонус «процент к пополнению» из промокода.
 * Ищем последнюю неиспользованную активацию DEPOSIT_PERCENT.
 */
export async function pendingDepositPercent(userId: string): Promise<number> {
  const use = await prisma.promoCodeUse.findFirst({
    where: { userId, promoCode: { type: 'DEPOSIT_PERCENT' } },
    orderBy: { createdAt: 'desc' },
    include: { promoCode: { select: { amount: true, code: true } } },
  });
  if (!use) return 0;

  // Промокод считается израсходованным, если после его активации было пополнение
  const usedAfter = await prisma.deposit.count({
    where: { userId, status: 'PAID', paidAt: { gt: use.createdAt } },
  });
  return usedAfter > 0 ? 0 : use.promoCode.amount;
}

export async function createPromo(data: {
  code: string;
  type: 'BALANCE' | 'DEPOSIT_PERCENT' | 'XP';
  amount: number;
  maxActivations?: number | null;
  perUserLimit?: number;
  expiresAt?: Date | null;
  description?: string | null;
}) {
  const code = data.code.trim().toUpperCase();
  try {
    return await prisma.promoCode.create({
      data: {
        code,
        type: data.type,
        amount: data.amount,
        maxActivations: data.maxActivations ?? null,
        perUserLimit: data.perUserLimit ?? 1,
        expiresAt: data.expiresAt ?? null,
        description: data.description ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw errors.validation('Промокод с таким кодом уже существует');
    }
    throw error;
  }
}
