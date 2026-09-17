import { Prisma } from '@prisma/client';
import { XP_RULES, type DepositDto } from '@nexus/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { errors } from '../errors.js';
import { getPaymentProvider } from '../payments/index.js';
import { credit } from './ledger.service.js';
import { notify } from './notification.service.js';
import { dailyOfferPercent } from './bonus.service.js';
import { pendingDepositPercent } from './promo.service.js';
import { rewardReferrerOnDeposit } from './referral.service.js';

export function toDepositDto(deposit: {
  id: string;
  amount: number;
  bonusAmount: number;
  bonusPercent: number;
  status: string;
  payUrl: string | null;
  provider: string;
  createdAt: Date;
}): DepositDto {
  return {
    id: deposit.id,
    amount: deposit.amount,
    bonusAmount: deposit.bonusAmount,
    bonusPercent: deposit.bonusPercent,
    status: deposit.status as DepositDto['status'],
    payUrl: deposit.payUrl,
    provider: deposit.provider,
    createdAt: deposit.createdAt.toISOString(),
  };
}

/** Итоговый процент бонуса: акция дня + активный промокод. */
export async function depositBonusPercent(userId: string): Promise<number> {
  const promoPercent = await pendingDepositPercent(userId);
  return dailyOfferPercent() + promoPercent;
}

/**
 * Создание платежа.
 * Сумма приходит от клиента, но пересчёт в монеты и бонус считает сервер.
 */
export async function createDeposit(userId: string, amount: number): Promise<DepositDto> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { telegramId: true, isBanned: true },
  });
  if (user.isBanned) throw errors.banned();

  const coins = Math.floor(amount * env.COINS_PER_CURRENCY_UNIT);
  if (coins <= 0) throw errors.validation('Слишком маленькая сумма');

  const bonusPercent = await depositBonusPercent(userId);
  const bonusAmount = Math.floor((coins * bonusPercent) / 100);
  const provider = getPaymentProvider();

  const deposit = await prisma.deposit.create({
    data: {
      userId,
      amount: coins,
      bonusAmount,
      bonusPercent,
      currency: env.PAYMENT_CURRENCY,
      provider: provider.id,
      status: 'PENDING',
    },
  });

  try {
    const payment = await provider.createPayment({
      depositId: deposit.id,
      userId,
      telegramId: user.telegramId.toString(),
      coins,
      amount,
      currency: env.PAYMENT_CURRENCY,
      description: `Пополнение баланса NEXUS на ${coins} B`,
    });

    const updated = await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        providerRef: payment.providerRef,
        payUrl: payment.payUrl,
        metadata: (payment.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    if (payment.paidImmediately) {
      await markDepositPaid(provider.id, payment.providerRef);
      const paid = await prisma.deposit.findUniqueOrThrow({ where: { id: deposit.id } });
      return toDepositDto(paid);
    }

    return toDepositDto(updated);
  } catch (error) {
    await prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'FAILED' } });
    throw error;
  }
}

/**
 * Подтверждение оплаты.
 * Идемпотентно: зачисление выполняется только для депозита в статусе PENDING,
 * поэтому повторный webhook не удвоит баланс.
 */
export async function markDepositPaid(providerId: string, providerRef: string): Promise<boolean> {
  const deposit = await prisma.deposit.findUnique({
    where: { provider_providerRef: { provider: providerId, providerRef } },
  });
  if (!deposit) throw errors.notFound('Платёж не найден');
  if (deposit.status === 'PAID') return false;

  const credited = await prisma.$transaction(async (tx) => {
    // Условный UPDATE — единственная точка, где депозит становится оплаченным
    const claimed = await tx.deposit.updateMany({
      where: { id: deposit.id, status: 'PENDING' },
      data: { status: 'PAID', paidAt: new Date() },
    });
    if (claimed.count === 0) return false;

    const total = deposit.amount + deposit.bonusAmount;

    await credit(tx, {
      userId: deposit.userId,
      amount: total,
      type: 'DEPOSIT',
      description:
        deposit.bonusAmount > 0
          ? `Пополнение ${deposit.amount} B + бонус ${deposit.bonusAmount} B`
          : `Пополнение ${deposit.amount} B`,
      metadata: { depositId: deposit.id, provider: providerId, bonusPercent: deposit.bonusPercent },
      xp: XP_RULES.deposit(deposit.amount),
    });

    await tx.user.update({
      where: { id: deposit.userId },
      data: { totalDeposited: { increment: deposit.amount } },
    });

    await notify(
      {
        userId: deposit.userId,
        type: 'DEPOSIT_SUCCESS',
        title: '💰 Пополнение успешно',
        body: `Баланс пополнен на ${total} B${deposit.bonusAmount > 0 ? ` (включая бонус ${deposit.bonusAmount} B)` : ''}.`,
        payload: { depositId: deposit.id },
      },
      tx,
    );

    return true;
  });

  if (credited) await rewardReferrerOnDeposit(deposit.userId, deposit.amount);
  return credited;
}

export async function markDepositFailed(providerId: string, providerRef: string): Promise<void> {
  await prisma.deposit.updateMany({
    where: { provider: providerId, providerRef, status: 'PENDING' },
    data: { status: 'FAILED' },
  });
}

export async function listDeposits(userId: string, limit = 30): Promise<DepositDto[]> {
  const deposits = await prisma.deposit.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });
  return deposits.map(toDepositDto);
}
