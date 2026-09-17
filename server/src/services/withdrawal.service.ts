import { maskRequisites, type WithdrawalDto } from '@nexus/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { errors } from '../errors.js';
import { credit, debit } from './ledger.service.js';
import { notify } from './notification.service.js';

function toDto(withdrawal: {
  id: string;
  amount: number;
  fee: number;
  payout: number;
  method: string;
  requisites: string;
  status: string;
  comment: string | null;
  createdAt: Date;
}): WithdrawalDto {
  return {
    id: withdrawal.id,
    amount: withdrawal.amount,
    fee: withdrawal.fee,
    payout: withdrawal.payout,
    method: withdrawal.method,
    // Наружу отдаём только маску: полные реквизиты видит лишь админ
    requisites: maskRequisites(withdrawal.requisites),
    status: withdrawal.status as WithdrawalDto['status'],
    comment: withdrawal.comment,
    createdAt: withdrawal.createdAt.toISOString(),
  };
}

export { toDto as toWithdrawalDto };

/**
 * Заявка на вывод.
 * Средства резервируются сразу: иначе игрок успеет потратить их до модерации.
 * При отклонении сумма возвращается на баланс.
 */
export async function createWithdrawal(params: {
  userId: string;
  amount: number;
  method: string;
  requisites: string;
}): Promise<WithdrawalDto> {
  const amount = Math.trunc(params.amount);
  if (amount < env.WITHDRAWAL_MIN) {
    throw errors.validation(`Минимальная сумма вывода — ${env.WITHDRAWAL_MIN} B`);
  }

  const fee = Math.floor((amount * env.WITHDRAWAL_FEE_PERCENT) / 100);
  const payout = amount - fee;

  const withdrawal = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${params.userId} FOR UPDATE`;

    const pending = await tx.withdrawal.count({ where: { userId: params.userId, status: 'PENDING' } });
    if (pending >= 3) throw errors.validation('Слишком много заявок в обработке');

    await debit(tx, {
      userId: params.userId,
      amount,
      type: 'WITHDRAWAL',
      description: `Заявка на вывод ${amount} B`,
      metadata: { method: params.method },
    });

    return tx.withdrawal.create({
      data: {
        userId: params.userId,
        amount,
        fee,
        payout,
        method: params.method,
        requisites: params.requisites,
        status: 'PENDING',
      },
    });
  });

  return toDto(withdrawal);
}

export async function listWithdrawals(userId: string, limit = 30): Promise<WithdrawalDto[]> {
  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });
  return withdrawals.map(toDto);
}

/** Подтверждение вывода: средства уже списаны, фиксируем результат. */
export async function approveWithdrawal(id: string, adminId: string, comment?: string): Promise<WithdrawalDto> {
  const withdrawal = await prisma.$transaction(async (tx) => {
    const claimed = await tx.withdrawal.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'APPROVED', processedById: adminId, processedAt: new Date(), comment },
    });
    if (claimed.count === 0) throw errors.validation('Заявка уже обработана');

    const updated = await tx.withdrawal.findUniqueOrThrow({ where: { id } });

    await notify(
      {
        userId: updated.userId,
        type: 'WITHDRAWAL_APPROVED',
        title: '💳 Заявка на вывод одобрена',
        body: `Вывод ${updated.amount} B подтверждён. К выплате: ${updated.payout} B.`,
        payload: { withdrawalId: updated.id },
      },
      tx,
    );

    await tx.adminAction.create({
      data: {
        adminId,
        action: 'withdrawal.approve',
        targetType: 'withdrawal',
        targetId: id,
        // Реквизиты в аудит не попадают
        payload: { amount: updated.amount, payout: updated.payout },
      },
    });

    return updated;
  });

  return toDto(withdrawal);
}

/** Отклонение вывода: зарезервированные средства возвращаются игроку. */
export async function rejectWithdrawal(id: string, adminId: string, comment?: string): Promise<WithdrawalDto> {
  const withdrawal = await prisma.$transaction(async (tx) => {
    const claimed = await tx.withdrawal.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', processedById: adminId, processedAt: new Date(), comment },
    });
    if (claimed.count === 0) throw errors.validation('Заявка уже обработана');

    const updated = await tx.withdrawal.findUniqueOrThrow({ where: { id } });

    await credit(tx, {
      userId: updated.userId,
      amount: updated.amount,
      type: 'WITHDRAWAL_REFUND',
      description: 'Возврат средств по отклонённой заявке',
      metadata: { withdrawalId: updated.id },
    });

    await notify(
      {
        userId: updated.userId,
        type: 'WITHDRAWAL_REJECTED',
        title: '↩️ Заявка отклонена',
        body: `Вывод ${updated.amount} B отклонён${comment ? `: ${comment}` : ''}. Средства возвращены на баланс.`,
        payload: { withdrawalId: updated.id },
      },
      tx,
    );

    await tx.adminAction.create({
      data: {
        adminId,
        action: 'withdrawal.reject',
        targetType: 'withdrawal',
        targetId: id,
        payload: { amount: updated.amount, comment: comment ?? null },
      },
    });

    return updated;
  });

  return toDto(withdrawal);
}
