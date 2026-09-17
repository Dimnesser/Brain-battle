import type { Prisma, TransactionType } from '@prisma/client';
import { levelFromXp } from '@nexus/shared';
import type { Tx } from '../db.js';
import { errors } from '../errors.js';

export interface BalanceMutation {
  userId: string;
  amount: number;
  type: TransactionType;
  description?: string;
  metadata?: Prisma.InputJsonValue;
  xp?: number;
}

export interface MutationResult {
  balance: number;
  xp: number;
  level: number;
  levelUp: boolean;
  transactionId: string;
}

/**
 * Начисление средств.
 * Вызывается ТОЛЬКО внутри prisma.$transaction — иначе баланс и запись
 * в истории могут разъехаться при падении процесса между двумя запросами.
 */
export async function credit(tx: Tx, params: BalanceMutation): Promise<MutationResult> {
  const amount = Math.trunc(params.amount);
  if (amount < 0) throw errors.internal('credit: сумма не может быть отрицательной');

  const xpGain = Math.max(0, Math.trunc(params.xp ?? 0));
  const before = await tx.user.findUnique({ where: { id: params.userId }, select: { xp: true } });
  if (!before) throw errors.notFound('Пользователь не найден');

  const user = await tx.user.update({
    where: { id: params.userId },
    data: {
      balance: { increment: amount },
      xp: xpGain > 0 ? { increment: xpGain } : undefined,
    },
    select: { balance: true, xp: true, level: true },
  });

  const { level, levelUp } = await syncLevel(tx, params.userId, before.xp, user.xp, user.level);

  const transaction = await tx.transaction.create({
    data: {
      userId: params.userId,
      type: params.type,
      status: 'COMPLETED',
      amount,
      balanceAfter: user.balance,
      description: params.description,
      metadata: params.metadata,
    },
    select: { id: true },
  });

  return { balance: user.balance, xp: user.xp, level, levelUp, transactionId: transaction.id };
}

/**
 * Списание средств с атомарной проверкой достаточности баланса.
 *
 * Условие `balance >= amount` выполняется тем же UPDATE, что и списание,
 * поэтому две параллельные попытки не могут увести баланс в минус:
 * второй UPDATE просто не найдёт подходящую строку.
 */
export async function debit(tx: Tx, params: BalanceMutation): Promise<MutationResult> {
  const amount = Math.trunc(params.amount);
  if (amount < 0) throw errors.internal('debit: сумма не может быть отрицательной');

  const before = await tx.user.findUnique({ where: { id: params.userId }, select: { xp: true } });
  if (!before) throw errors.notFound('Пользователь не найден');

  const updated = await tx.user.updateMany({
    where: { id: params.userId, balance: { gte: amount }, isBanned: false },
    data: { balance: { decrement: amount } },
  });

  if (updated.count === 0) {
    const user = await tx.user.findUnique({ where: { id: params.userId }, select: { isBanned: true } });
    if (user?.isBanned) throw errors.banned();
    throw errors.insufficientFunds();
  }

  const xpGain = Math.max(0, Math.trunc(params.xp ?? 0));
  const user =
    xpGain > 0
      ? await tx.user.update({
          where: { id: params.userId },
          data: { xp: { increment: xpGain } },
          select: { balance: true, xp: true, level: true },
        })
      : await tx.user.findUniqueOrThrow({
          where: { id: params.userId },
          select: { balance: true, xp: true, level: true },
        });

  const { level, levelUp } = await syncLevel(tx, params.userId, before.xp, user.xp, user.level);

  const transaction = await tx.transaction.create({
    data: {
      userId: params.userId,
      type: params.type,
      status: 'COMPLETED',
      amount: -amount,
      balanceAfter: user.balance,
      description: params.description,
      metadata: params.metadata,
    },
    select: { id: true },
  });

  return { balance: user.balance, xp: user.xp, level, levelUp, transactionId: transaction.id };
}

/** Пересчёт уровня по XP. Уровень — производная величина, её нельзя задать извне. */
async function syncLevel(
  tx: Tx,
  userId: string,
  xpBefore: number,
  xpAfter: number,
  storedLevel: number,
): Promise<{ level: number; levelUp: boolean }> {
  const level = levelFromXp(xpAfter);
  const previousLevel = levelFromXp(xpBefore);

  if (level !== storedLevel) {
    await tx.user.update({ where: { id: userId }, data: { level } });
  }

  return { level, levelUp: level > previousLevel };
}
