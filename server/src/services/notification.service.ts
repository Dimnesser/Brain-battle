import type { NotificationType, Prisma } from '@prisma/client';
import type { Tx } from '../db.js';
import { prisma } from '../db.js';

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload?: Prisma.InputJsonValue;
}

/**
 * Уведомление кладётся в БД, а рассылает его воркер бота.
 * Так API не зависит от доступности Telegram и не блокирует ответ игроку.
 */
export async function notify(params: NotifyParams, tx: Tx = prisma): Promise<void> {
  await tx.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      payload: params.payload,
    },
  });
}

export async function listNotifications(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}
