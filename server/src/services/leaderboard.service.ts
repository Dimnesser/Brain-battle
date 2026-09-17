import { displayName, type LeaderboardDto, type LeaderboardEntry, type LeaderboardMetric } from '@nexus/shared';
import { prisma } from '../db.js';

const METRIC_FIELD: Record<Exclude<LeaderboardMetric, 'referrals'>, MetricField> = {
  wins: 'totalWon',
  balance: 'balance',
  cases: 'casesOpened',
};

type MetricField = 'totalWon' | 'balance' | 'casesOpened';

/** Единый набор полей: значение метрики выбирается уже из готовой строки. */
const PROFILE_SELECT = {
  id: true,
  username: true,
  firstName: true,
  avatar: true,
  level: true,
  totalWon: true,
  balance: true,
  casesOpened: true,
} as const;

/** Рейтинг игроков. Забаненные в выдачу не попадают. */
export async function getLeaderboard(
  metric: LeaderboardMetric,
  currentUserId: string,
  limit = 50,
): Promise<LeaderboardDto> {
  if (metric === 'referrals') return referralLeaderboard(currentUserId, limit);

  const field = METRIC_FIELD[metric];

  const users = await prisma.user.findMany({
    where: { isBanned: false, [field]: { gt: 0 } },
    orderBy: [{ [field]: 'desc' }, { createdAt: 'asc' }],
    take: limit,
    select: PROFILE_SELECT,
  });

  const entries: LeaderboardEntry[] = users.map((user, index) => ({
    place: index + 1,
    userId: user.id,
    name: displayName(user),
    avatar: user.avatar,
    level: user.level,
    value: user[field],
    isMe: user.id === currentUserId,
  }));

  const me = entries.find((entry) => entry.isMe) ?? (await selfEntry(currentUserId, field));
  return { metric, entries, me };
}

async function selfEntry(userId: string, field: MetricField): Promise<LeaderboardEntry | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
  if (!user) return null;

  const value = user[field];
  const better = await prisma.user.count({ where: { isBanned: false, [field]: { gt: value } } });

  return {
    place: better + 1,
    userId: user.id,
    name: displayName(user),
    avatar: user.avatar,
    level: user.level,
    value,
    isMe: true,
  };
}

async function referralLeaderboard(currentUserId: string, limit: number): Promise<LeaderboardDto> {
  const grouped = await prisma.user.groupBy({
    by: ['referredById'],
    where: { referredById: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { referredById: 'desc' } },
    take: limit,
  });

  const ids = grouped.map((row) => row.referredById!).filter(Boolean);
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, isBanned: false },
    select: { id: true, username: true, firstName: true, avatar: true, level: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));

  const entries: LeaderboardEntry[] = grouped
    .filter((row) => byId.has(row.referredById!))
    .map((row, index) => {
      const user = byId.get(row.referredById!)!;
      return {
        place: index + 1,
        userId: user.id,
        name: displayName(user),
        avatar: user.avatar,
        level: user.level,
        value: row._count._all,
        isMe: user.id === currentUserId,
      };
    });

  let me = entries.find((entry) => entry.isMe) ?? null;
  if (!me) {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { id: true, username: true, firstName: true, avatar: true, level: true },
    });
    if (user) {
      const value = await prisma.user.count({ where: { referredById: currentUserId } });
      me = {
        place: entries.length + 1,
        userId: user.id,
        name: displayName(user),
        avatar: user.avatar,
        level: user.level,
        value,
        isMe: true,
      };
    }
  }

  return { metric: 'referrals', entries, me };
}
