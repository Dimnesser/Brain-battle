import type { Case, CaseCategory, CaseReward } from '@prisma/client';
import {
  XP_RULES,
  displayName,
  type CaseDetailDto,
  type CaseDto,
  type CaseRewardDto,
  type OpenCaseResult,
  type WinFeedItem,
} from '@nexus/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { errors } from '../errors.js';
import { normalizeChances, weightedPick } from '../lib/random.js';
import { secondsBetween, addSeconds } from '../lib/time.js';
import { hub } from '../realtime/hub.js';
import { credit, debit } from './ledger.service.js';
import { notify } from './notification.service.js';

type CaseWithRewards = Case & { rewards: CaseReward[] };

/** Длина ленты анимации и позиция выигрышного элемента в ней. */
const ROLL_LENGTH = 48;
const ROLL_WINNER_INDEX = 40;

function rewardDto(reward: CaseReward, chance: number): CaseRewardDto {
  return {
    id: reward.id,
    name: reward.name,
    amount: reward.amount,
    image: reward.image,
    rarity: reward.rarity,
    chance,
  };
}

function caseDto(item: CaseWithRewards, availableInSeconds?: number): CaseDto {
  const amounts = item.rewards.map((r) => r.amount);
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    image: item.image,
    accent: item.accent,
    price: item.price,
    category: item.category,
    isFree: item.price === 0,
    minReward: amounts.length ? Math.min(...amounts) : 0,
    maxReward: amounts.length ? Math.max(...amounts) : 0,
    rewardCount: item.rewards.length,
    cooldownSeconds: item.cooldownSeconds,
    ...(availableInSeconds !== undefined ? { availableInSeconds } : {}),
  };
}

/** Через сколько секунд бесплатный кейс снова можно открыть (0 — уже можно). */
export async function freeCaseAvailability(userId: string, item: Case): Promise<number> {
  if (item.price !== 0 || !item.cooldownSeconds) return 0;

  const last = await prisma.caseOpening.findFirst({
    where: { userId, caseId: item.id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!last) return 0;

  return secondsBetween(new Date(), addSeconds(last.createdAt, item.cooldownSeconds));
}

export async function listCases(userId: string, category?: CaseCategory): Promise<CaseDto[]> {
  const cases = await prisma.case.findMany({
    where: { isActive: true, ...(category ? { category } : {}) },
    include: { rewards: true },
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
  });

  return Promise.all(
    cases.map(async (item) =>
      item.price === 0 ? caseDto(item, await freeCaseAvailability(userId, item)) : caseDto(item),
    ),
  );
}

export async function getCaseDetail(userId: string, idOrSlug: string): Promise<CaseDetailDto> {
  const item = await prisma.case.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: { rewards: { orderBy: { amount: 'asc' } } },
  });
  if (!item) throw errors.notFound('Кейс не найден');

  const withChances = normalizeChances(item.rewards);
  const base = caseDto(item, item.price === 0 ? await freeCaseAvailability(userId, item) : undefined);

  return {
    ...base,
    rewards: withChances
      .map((reward) => rewardDto(reward, reward.chance))
      .sort((a, b) => b.amount - a.amount),
  };
}

/**
 * Лента для анимации барабана.
 * Строится на сервере: клиент получает уже готовый массив и индекс победителя,
 * поэтому подменить результат в DevTools нельзя — он уже записан в БД.
 */
function buildRoll(rewards: Array<CaseReward & { chance: number }>, winner: CaseReward) {
  const items: CaseRewardDto[] = [];
  for (let i = 0; i < ROLL_LENGTH; i++) {
    const pick = weightedPick(rewards);
    items.push(rewardDto(pick, pick.chance));
  }
  const winnerChance = rewards.find((r) => r.id === winner.id)?.chance ?? 0;
  items[ROLL_WINNER_INDEX] = rewardDto(winner, winnerChance);
  return { items, winnerIndex: ROLL_WINNER_INDEX };
}

export interface OpenCaseParams {
  userId: string;
  caseId: string;
}

/**
 * Открытие кейса.
 *
 * Всё выполняется в одной транзакции PostgreSQL:
 *   1. блокировка строки игрока (FOR UPDATE) — сериализует параллельные открытия;
 *   2. проверка кейса и кулдауна бесплатного кейса;
 *   3. атомарное списание стоимости;
 *   4. выбор награды на сервере по весам из БД;
 *   5. начисление выигрыша и запись истории.
 *
 * Клиент не участвует в выборе награды и не может повлиять на цену.
 */
export async function openCase({ userId, caseId }: OpenCaseParams): Promise<OpenCaseResult> {
  const result = await prisma.$transaction(async (tx) => {
    // Блокировка строки игрока: два одновременных запроса выстроятся в очередь,
    // иначе проверку кулдауна можно было бы пройти дважды
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const player = await tx.user.findUnique({
      where: { id: userId },
      select: { isBanned: true, level: true, xp: true },
    });
    if (!player) throw errors.notFound('Пользователь не найден');
    if (player.isBanned) throw errors.banned();

    const item = await tx.case.findFirst({
      where: { OR: [{ id: caseId }, { slug: caseId }] },
      include: { rewards: true },
    });
    if (!item) throw errors.notFound('Кейс не найден');
    if (!item.isActive) throw errors.validation('Кейс сейчас недоступен');
    if (item.rewards.length === 0) throw errors.validation('У кейса нет наград');

    // Кулдаун бесплатного кейса проверяется внутри блокировки — повторный
    // вызов API во время анимации не пройдёт
    if (item.price === 0 && item.cooldownSeconds) {
      const last = await tx.caseOpening.findFirst({
        where: { userId, caseId: item.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (last) {
        const wait = secondsBetween(new Date(), addSeconds(last.createdAt, item.cooldownSeconds));
        if (wait > 0) throw errors.cooldown(wait, 'Бесплатный кейс ещё не восстановился');
      }
    }

    if (item.price > 0) {
      await debit(tx, {
        userId,
        amount: item.price,
        type: 'CASE_PURCHASE',
        description: `Открытие кейса «${item.name}»`,
        metadata: { caseId: item.id, caseName: item.name },
      });
    }

    const withChances = normalizeChances(item.rewards);
    const winner = weightedPick(withChances);

    const rewardMutation = await credit(tx, {
      userId,
      amount: winner.amount,
      type: 'CASE_REWARD',
      description: `Выигрыш из кейса «${item.name}»`,
      metadata: { caseId: item.id, rewardId: winner.id, rewardName: winner.name },
      xp: XP_RULES.caseOpen(item.price),
    });

    const opening = await tx.caseOpening.create({
      data: {
        userId,
        caseId: item.id,
        rewardId: winner.id,
        price: item.price,
        amount: winner.amount,
        profit: winner.amount - item.price,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        casesOpened: { increment: 1 },
        totalWon: { increment: winner.amount },
        totalWagered: { increment: item.price },
      },
    });

    const nextFree =
      item.price === 0 && item.cooldownSeconds ? item.cooldownSeconds : undefined;

    return {
      item,
      winner,
      withChances,
      opening,
      mutation: rewardMutation,
      nextFree,
    };
  });

  const { item, winner, withChances, opening, mutation, nextFree } = result;

  // Побочные эффекты — вне транзакции: они не должны откатывать выигрыш
  if (winner.amount >= env.BIG_WIN_THRESHOLD) {
    const player = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, firstName: true, avatar: true, level: true },
    });

    await notify({
      userId,
      type: 'BIG_WIN',
      title: '🎉 Крупный выигрыш',
      body: `Из кейса «${item.name}» выпало ${winner.amount} B. Поздравляем!`,
      payload: { caseId: item.id, amount: winner.amount },
    });

    if (player) {
      const feedItem: WinFeedItem = {
        id: opening.id,
        user: { name: displayName(player), avatar: player.avatar, level: player.level },
        caseName: item.name,
        caseImage: item.image,
        amount: winner.amount,
        rarity: winner.rarity,
        createdAt: opening.createdAt.toISOString(),
      };
      hub.broadcast({ type: 'win', payload: feedItem });
    }
  }

  const winnerChance = withChances.find((r) => r.id === winner.id)?.chance ?? 0;

  return {
    opening: {
      id: opening.id,
      caseId: item.id,
      caseName: item.name,
      price: item.price,
      amount: opening.amount,
      profit: opening.profit,
      createdAt: opening.createdAt.toISOString(),
    },
    reward: rewardDto(winner, winnerChance),
    roll: buildRoll(withChances, winner),
    balance: mutation.balance,
    level: mutation.level,
    xp: mutation.xp,
    levelUp: mutation.levelUp,
    ...(nextFree !== undefined ? { nextFreeCaseInSeconds: nextFree } : {}),
  };
}

/** Лента последних крупных выигрышей для главной страницы. */
export async function recentWins(limit = 20): Promise<WinFeedItem[]> {
  const openings = await prisma.caseOpening.findMany({
    where: { amount: { gte: env.BIG_WIN_THRESHOLD } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
    include: {
      user: { select: { username: true, firstName: true, avatar: true, level: true } },
      case: { select: { name: true, image: true } },
      reward: { select: { rarity: true } },
    },
  });

  return openings.map((opening) => ({
    id: opening.id,
    user: {
      name: displayName(opening.user),
      avatar: opening.user.avatar,
      level: opening.user.level,
    },
    caseName: opening.case.name,
    caseImage: opening.case.image,
    amount: opening.amount,
    rarity: opening.reward.rarity,
    createdAt: opening.createdAt.toISOString(),
  }));
}

/** История открытий игрока. */
export async function userOpenings(userId: string, limit = 30) {
  return prisma.caseOpening.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    include: {
      case: { select: { name: true, image: true } },
      reward: { select: { name: true, rarity: true, image: true } },
    },
  });
}
