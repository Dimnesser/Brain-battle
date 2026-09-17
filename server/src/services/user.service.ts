import type { Prisma, User } from '@prisma/client';
import { levelProgress, levelTitle, type UserDto } from '@nexus/shared';
import { prisma } from '../db.js';
import { adminTelegramIds, env } from '../env.js';
import { errors } from '../errors.js';
import { generateReferralCode } from '../lib/random.js';
import { daysBetween } from '../lib/time.js';
import { credit } from './ledger.service.js';
import { attachReferral } from './referral.service.js';
import type { TelegramUserPayload } from '../auth/telegram.js';

export interface UpsertResult {
  user: User;
  created: boolean;
  startBonus: number;
}

/** Уникальный реферальный код: коллизии крайне редки, но обрабатываются. */
async function uniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    const exists = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw errors.internal('Не удалось сгенерировать реферальный код');
}

/**
 * Создаёт или обновляет игрока по данным Telegram.
 * Профильные поля всегда берутся из подписанного initData, а не из тела запроса.
 */
export async function upsertTelegramUser(
  payload: TelegramUserPayload,
  startParam?: string,
): Promise<UpsertResult> {
  const telegramId = BigInt(payload.id);
  const isAdmin = adminTelegramIds.some((id) => id === telegramId);

  const profile: Prisma.UserUpdateInput = {
    username: payload.username ?? null,
    firstName: payload.first_name ?? null,
    lastName: payload.last_name ?? null,
    avatar: payload.photo_url ?? null,
    languageCode: payload.language_code ?? null,
    lastSeenAt: new Date(),
  };

  const existing = await prisma.user.findUnique({ where: { telegramId } });

  if (existing) {
    // Права администратора синхронизируются с ADMIN_TELEGRAM_ID, но не снимаются
    // с тех, кому их выдали вручную через админку
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { ...profile, isAdmin: isAdmin ? true : existing.isAdmin },
    });
    return { user, created: false, startBonus: 0 };
  }

  const referralCode = await uniqueReferralCode();

  const created = await prisma.user.create({
    data: {
      telegramId,
      username: payload.username ?? null,
      firstName: payload.first_name ?? null,
      lastName: payload.last_name ?? null,
      avatar: payload.photo_url ?? null,
      languageCode: payload.language_code ?? null,
      referralCode,
      isAdmin,
      lastSeenAt: new Date(),
    },
  });

  let startBonus = 0;
  if (env.START_BONUS > 0) {
    await prisma.$transaction(async (tx) => {
      await credit(tx, {
        userId: created.id,
        amount: env.START_BONUS,
        type: 'BONUS',
        description: 'Стартовый бонус',
        xp: 10,
      });
    });
    startBonus = env.START_BONUS;
  }

  if (startParam) await attachReferral(created.id, startParam);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
  return { user, created: true, startBonus };
}

/** Отметка входа: обновляет серию и «последний визит». */
export async function touchLogin(userId: string): Promise<{ streak: number; isNewDay: boolean }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { lastLoginAt: true, loginStreak: true },
  });

  const now = new Date();
  const diff = user.lastLoginAt ? daysBetween(user.lastLoginAt, now) : null;

  if (diff === 0) {
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: now } });
    return { streak: user.loginStreak, isNewDay: false };
  }

  // Пропуск больше суток обнуляет серию
  const streak = diff === 1 ? user.loginStreak + 1 : 1;

  await prisma.user.update({
    where: { id: userId },
    data: { loginStreak: streak, lastLoginAt: now, lastSeenAt: now },
  });

  return { streak, isNewDay: true };
}

export async function getUserById(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.notFound('Пользователь не найден');
  return user;
}

export async function toUserDto(user: User): Promise<UserDto> {
  const referrals = await prisma.user.count({ where: { referredById: user.id } });
  return userDto(user, referrals);
}

export function userDto(user: User, referrals: number): UserDto {
  const progress = levelProgress(user.xp);
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    avatar: user.avatar,
    balance: user.balance,
    level: progress.level,
    xp: user.xp,
    levelTitle: levelTitle(progress.level),
    progress: {
      percent: progress.percent,
      xpIntoLevel: progress.xpIntoLevel,
      xpForNextLevel: progress.xpForNextLevel,
      isMax: progress.isMax,
    },
    referralCode: user.referralCode,
    isAdmin: user.isAdmin,
    isBanned: user.isBanned,
    stats: {
      casesOpened: user.casesOpened,
      totalWon: user.totalWon,
      totalDeposited: user.totalDeposited,
      totalWagered: user.totalWagered,
      referrals,
      referralEarned: user.referralEarned,
      loginStreak: user.loginStreak,
    },
    createdAt: user.createdAt.toISOString(),
  };
}
