import { createHash } from 'node:crypto';
import { Prisma, type BonusType } from '@prisma/client';
import {
  STREAK_REWARDS,
  STREAK_TARGET,
  XP_RULES,
  type BonusCardDto,
  type BonusOverviewDto,
  type ClaimBonusResult,
} from '@nexus/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { errors } from '../errors.js';
import { dayKey, secondsUntilMidnight } from '../lib/time.js';
import { credit } from './ledger.service.js';
import { freeCaseAvailability } from './case.service.js';

const REFERRAL_MILESTONES = [
  { count: 3, reward: 300 },
  { count: 10, reward: 1200 },
  { count: 25, reward: 3500 },
  { count: 50, reward: 8000 },
  { count: 100, reward: 20_000 },
];

/**
 * «Бонус дня» — процент к пополнению.
 * Детерминирован по дате: все игроки и все инстансы сервера видят одно и то же,
 * но угадать его заранее нельзя без серверного секрета.
 */
export function dailyOfferPercent(date = new Date()): number {
  const seed = createHash('sha256').update(`${dayKey(date)}:${env.JWT_SECRET}`).digest();
  const options = [10, 15, 20, 25, 30];
  return options[seed[0]! % options.length]!;
}

function streakReward(streak: number): number {
  const index = Math.min(Math.max(streak, 1), STREAK_TARGET) - 1;
  return STREAK_REWARDS[index] ?? STREAK_REWARDS[STREAK_REWARDS.length - 1]!;
}

function dailyAmount(streak: number): number {
  // База + надбавка за серию, с потолком, чтобы экономика не разгонялась
  return env.DAILY_BONUS_BASE + Math.min(streak, 10) * 10;
}

async function hasClaim(userId: string, type: BonusType, periodKey: string): Promise<boolean> {
  const claim = await prisma.bonusClaim.findUnique({
    where: { userId_type_periodKey: { userId, type, periodKey } },
    select: { id: true },
  });
  return Boolean(claim);
}

function streakPeriodKey(streak: number): string {
  return `cycle:${Math.floor(Math.max(streak - 1, 0) / STREAK_TARGET)}`;
}

export async function getBonusOverview(userId: string): Promise<BonusOverviewDto> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { loginStreak: true, referralEarned: true },
  });

  const streak = Math.max(user.loginStreak, 1);
  const today = dayKey();
  const referrals = await prisma.user.count({ where: { referredById: userId } });

  const [dailyClaimed, streakClaimed, subscriptionClaimed] = await Promise.all([
    hasClaim(userId, 'DAILY', today),
    hasClaim(userId, 'STREAK', streakPeriodKey(streak)),
    hasClaim(userId, 'SUBSCRIPTION', 'once'),
  ]);

  const milestone =
    REFERRAL_MILESTONES.find((m) => m.count > referrals) ?? REFERRAL_MILESTONES[REFERRAL_MILESTONES.length - 1]!;
  const reachedMilestone = [...REFERRAL_MILESTONES].reverse().find((m) => referrals >= m.count);
  const milestoneClaimed = reachedMilestone
    ? await hasClaim(userId, 'REFERRAL_MILESTONE', `milestone:${reachedMilestone.count}`)
    : true;

  const freeCase = await prisma.case.findFirst({
    where: { isActive: true, price: 0 },
    orderBy: { sortOrder: 'asc' },
  });
  const freeCaseWait = freeCase ? await freeCaseAvailability(userId, freeCase) : 0;

  const bonuses: BonusCardDto[] = [
    {
      type: 'DAILY',
      title: '🎁 Ежедневный бонус',
      description: 'Заходи каждый день и забирай монеты',
      amount: dailyAmount(user.loginStreak),
      available: !dailyClaimed,
      claimed: dailyClaimed,
      availableInSeconds: dailyClaimed ? secondsUntilMidnight() : 0,
    },
    {
      type: 'STREAK',
      title: '🔥 Серия входов',
      description: `Собери ${STREAK_TARGET} дней подряд и получи крупный бонус`,
      amount: streakReward(STREAK_TARGET),
      available: streak >= STREAK_TARGET && !streakClaimed,
      claimed: streakClaimed,
      availableInSeconds: streak >= STREAK_TARGET ? 0 : secondsUntilMidnight(),
      progress: { current: Math.min(streak, STREAK_TARGET), target: STREAK_TARGET },
    },
    {
      type: 'SUBSCRIPTION',
      title: '📣 Бонус за подписку',
      description: env.SUBSCRIPTION_CHANNEL
        ? `Подпишись на ${env.SUBSCRIPTION_CHANNEL} и получи награду`
        : 'Подпишись на наш канал и получи награду',
      amount: 200,
      available: !subscriptionClaimed,
      claimed: subscriptionClaimed,
      availableInSeconds: 0,
      meta: { channel: env.SUBSCRIPTION_CHANNEL || null },
    },
    {
      type: 'REFERRAL_MILESTONE',
      title: '👥 Бонус за рефералов',
      description: reachedMilestone
        ? `Награда за ${reachedMilestone.count} приглашённых друзей`
        : `Пригласи ${milestone.count} друзей и забери награду`,
      amount: reachedMilestone?.reward ?? milestone.reward,
      available: Boolean(reachedMilestone) && !milestoneClaimed,
      claimed: milestoneClaimed && Boolean(reachedMilestone),
      availableInSeconds: 0,
      progress: { current: Math.min(referrals, milestone.count), target: milestone.count },
    },
    {
      type: 'FREE_CASE',
      title: '🆓 Бесплатный кейс',
      description: freeCase ? `Кейс «${freeCase.name}» раз в 24 часа` : 'Скоро появится',
      amount: 0,
      available: Boolean(freeCase) && freeCaseWait === 0,
      claimed: freeCaseWait > 0,
      availableInSeconds: freeCaseWait,
      meta: { caseId: freeCase?.id ?? null, caseSlug: freeCase?.slug ?? null },
    },
  ];

  return {
    dailyOffer: {
      percent: dailyOfferPercent(),
      endsInSeconds: secondsUntilMidnight(),
      title: `+${dailyOfferPercent()}% к пополнению`,
    },
    streak: {
      current: Math.min(streak, STREAK_TARGET),
      target: STREAK_TARGET,
      nextReward: streakReward(Math.min(streak + 1, STREAK_TARGET)),
    },
    bonuses,
  };
}

/** Проверка подписки на канал через Telegram Bot API. */
async function isSubscribed(telegramId: bigint): Promise<boolean> {
  if (!env.SUBSCRIPTION_CHANNEL || !env.BOT_TOKEN) return true;
  try {
    const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(
      env.SUBSCRIPTION_CHANNEL,
    )}&user_id=${telegramId.toString()}`;
    const response = await fetch(url);
    const data = (await response.json()) as { ok: boolean; result?: { status: string } };
    if (!data.ok || !data.result) return false;
    return ['creator', 'administrator', 'member'].includes(data.result.status);
  } catch {
    // Недоступность Telegram не должна выдавать бонус «в кредит»
    return false;
  }
}

/**
 * Выдача бонуса.
 * Защита от повтора — уникальный индекс (userId, type, periodKey):
 * даже параллельные запросы приведут к одной записи, вторая упадёт с P2002.
 */
export async function claimBonus(userId: string, type: BonusType): Promise<ClaimBonusResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { telegramId: true, loginStreak: true, isBanned: true },
  });
  if (user.isBanned) throw errors.banned();

  let amount = 0;
  let periodKey = dayKey();
  let message = 'Бонус получен';
  let xp = 0;

  switch (type) {
    case 'DAILY': {
      amount = dailyAmount(user.loginStreak);
      periodKey = dayKey();
      xp = XP_RULES.dailyLogin;
      message = 'Ежедневный бонус зачислен';
      break;
    }
    case 'STREAK': {
      const streak = Math.max(user.loginStreak, 1);
      if (streak < STREAK_TARGET) {
        throw errors.validation(`Серия ещё не завершена: ${streak} из ${STREAK_TARGET} дней`);
      }
      amount = streakReward(STREAK_TARGET);
      periodKey = streakPeriodKey(streak);
      xp = 50;
      message = `Награда за ${STREAK_TARGET} дней подряд`;
      break;
    }
    case 'SUBSCRIPTION': {
      const subscribed = await isSubscribed(user.telegramId);
      if (!subscribed) throw errors.validation('Подписка на канал не найдена');
      amount = 200;
      periodKey = 'once';
      xp = 20;
      message = 'Бонус за подписку зачислен';
      break;
    }
    case 'REFERRAL_MILESTONE': {
      const referrals = await prisma.user.count({ where: { referredById: userId } });
      const reached = [...REFERRAL_MILESTONES].reverse().find((m) => referrals >= m.count);
      if (!reached) throw errors.validation('Пригласите больше друзей, чтобы забрать награду');
      amount = reached.reward;
      periodKey = `milestone:${reached.count}`;
      xp = 40;
      message = `Награда за ${reached.count} приглашённых`;
      break;
    }
    case 'FREE_CASE':
      // Бесплатный кейс выдаётся через открытие кейса, а не через бонусы
      throw errors.validation('Бесплатный кейс открывается в разделе «Кейсы»');
    default:
      throw errors.validation('Неизвестный тип бонуса');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.bonusClaim.create({ data: { userId, type, amount, periodKey } });
      return credit(tx, {
        userId,
        amount,
        type: 'BONUS',
        description: message,
        metadata: { bonusType: type, periodKey },
        xp,
      });
    });

    return {
      type,
      amount,
      balance: result.balance,
      xp: result.xp,
      level: result.level,
      message,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw errors.alreadyClaimed('Этот бонус уже получен');
    }
    throw error;
  }
}
