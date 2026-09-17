import type { ReferralDto } from '@nexus/shared';
import { displayName } from '@nexus/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { credit } from './ledger.service.js';
import { notify } from './notification.service.js';

/** Из `ref_ABC123` / `ABC123` достаём сам код. */
export function parseStartParam(startParam?: string | null): string | null {
  if (!startParam) return null;
  const raw = startParam.startsWith('ref_') ? startParam.slice(4) : startParam;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(code) ? code : null;
}

/**
 * Привязка нового игрока к пригласившему.
 * Идемпотентна: уникальный refereeId не даст начислить бонус дважды,
 * а сама привязка возможна только пока у игрока ещё нет реферера.
 */
export async function attachReferral(userId: string, startParam?: string | null): Promise<boolean> {
  const code = parseStartParam(startParam);
  if (!code) return false;

  const referrer = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true, isBanned: true } });
  if (!referrer || referrer.isBanned) return false;
  // Самоприглашение — самый частый способ «накрутить» бонус
  if (referrer.id === userId) return false;

  const existing = await prisma.referral.findUnique({ where: { refereeId: userId }, select: { id: true } });
  if (existing) return false;

  const referee = await prisma.user.findUnique({ where: { id: userId }, select: { referredById: true } });
  if (!referee || referee.referredById) return false;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { referredById: referrer.id } });

    await tx.referral.create({
      data: {
        referrerId: referrer.id,
        refereeId: userId,
        referrerBonus: env.REFERRER_BONUS,
        refereeBonus: env.REFEREE_BONUS,
        earned: env.REFERRER_BONUS,
      },
    });

    if (env.REFERRER_BONUS > 0) {
      await credit(tx, {
        userId: referrer.id,
        amount: env.REFERRER_BONUS,
        type: 'REFERRAL',
        description: 'Бонус за приглашённого друга',
        xp: 100,
      });
      await tx.user.update({
        where: { id: referrer.id },
        data: { referralEarned: { increment: env.REFERRER_BONUS } },
      });
    }

    if (env.REFEREE_BONUS > 0) {
      await credit(tx, {
        userId,
        amount: env.REFEREE_BONUS,
        type: 'REFERRAL',
        description: 'Бонус за вход по приглашению',
        xp: 25,
      });
    }

    await notify(
      {
        userId: referrer.id,
        type: 'NEW_REFERRAL',
        title: '👥 Новый реферал',
        body: `Твой друг присоединился к NEXUS. Бонус +${env.REFERRER_BONUS} B уже на балансе.`,
      },
      tx,
    );
  });

  return true;
}

/** Начисление реферального процента с пополнения приглашённого. */
export async function rewardReferrerOnDeposit(userId: string, depositAmount: number): Promise<void> {
  const referral = await prisma.referral.findUnique({ where: { refereeId: userId } });
  if (!referral) return;

  const bonus = Math.floor(depositAmount * 0.1);
  if (bonus <= 0) return;

  await prisma.$transaction(async (tx) => {
    await credit(tx, {
      userId: referral.referrerId,
      amount: bonus,
      type: 'REFERRAL',
      description: 'Процент с пополнения реферала',
      metadata: { refereeId: userId, depositAmount },
    });
    await tx.user.update({
      where: { id: referral.referrerId },
      data: { referralEarned: { increment: bonus } },
    });
    await tx.referral.update({ where: { id: referral.id }, data: { earned: { increment: bonus } } });
  });
}

export async function getReferralOverview(userId: string): Promise<ReferralDto> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { referralCode: true, referralEarned: true },
  });

  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      referee: { select: { id: true, username: true, firstName: true, avatar: true, level: true } },
    },
  });

  const link = `https://t.me/${env.BOT_USERNAME}?start=ref_${user.referralCode}`;

  return {
    code: user.referralCode,
    link,
    shareText: `Заходи в NEXUS — открывай кейсы и забирай награды. Твой стартовый бонус уже ждёт 🎁`,
    invited: referrals.length,
    earned: user.referralEarned,
    referrerBonus: env.REFERRER_BONUS,
    refereeBonus: env.REFEREE_BONUS,
    list: referrals.map((referral) => ({
      id: referral.referee.id,
      name: displayName(referral.referee),
      avatar: referral.referee.avatar,
      level: referral.referee.level,
      earned: referral.earned,
      joinedAt: referral.createdAt.toISOString(),
    })),
  };
}
