import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import clsx from 'clsx';
import { formatCompact, type LeaderboardEntry, type LeaderboardMetric } from '@nexus/shared';
import { api } from '../lib/api';
import { Avatar, Card, EmptyState, Skeleton, Tabs } from '../components/ui';
import type { ReactElement } from 'react';

const TABS: ReadonlyArray<{ id: LeaderboardMetric; label: string }> = [
  { id: 'wins', label: '🏆 Выигрыши' },
  { id: 'balance', label: '💰 Баланс' },
  { id: 'cases', label: '🎁 Кейсы' },
  { id: 'referrals', label: '👥 Рефералы' },
];

const SUFFIX: Record<LeaderboardMetric, string> = {
  wins: 'B',
  balance: 'B',
  cases: 'шт.',
  referrals: 'чел.',
};

const PODIUM = ['🥇', '🥈', '🥉'];

export function LeaderboardPage(): ReactElement {
  const [metric, setMetric] = useState<LeaderboardMetric>('wins');
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', metric],
    queryFn: () => api.leaderboard(metric),
  });

  const entries = data?.entries ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="font-display text-2xl font-extrabold">Рейтинг</h1>
        <p className="text-[13px] text-text-muted">Лучшие игроки NEXUS</p>
      </div>

      <Tabs tabs={TABS} value={metric} onChange={setMetric} />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-[58px]" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon="🏆" title="Рейтинг пуст" hint="Стань первым в этой категории" />
      ) : (
        <>
          {/* Пьедестал */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 items-end gap-2">
              {[top3[1], top3[0], top3[2]].map((entry, index) => {
                if (!entry) return <div key={index} />;
                const isFirst = entry.place === 1;

                return (
                  <div
                    key={entry.userId}
                    className={clsx(
                      'neon-border glass flex flex-col items-center gap-1.5 p-3 text-center',
                      isFirst && 'shadow-glow',
                      entry.isMe && 'ring-1 ring-secondary/50',
                    )}
                    style={{ paddingTop: isFirst ? 20 : 12 }}
                  >
                    <span className="text-xl">{PODIUM[entry.place - 1]}</span>
                    <Avatar src={entry.avatar} name={entry.name} size={isFirst ? 52 : 42} ring={isFirst} />
                    <p className="w-full truncate text-[11px] font-semibold">{entry.name}</p>
                    <p className="font-display text-[13px] font-bold tabular-nums text-secondary">
                      {formatCompact(entry.value)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            {rest.map((entry) => (
              <Row key={entry.userId} entry={entry} metric={metric} />
            ))}
          </div>
        </>
      )}

      {/* Моя позиция всегда видна, даже если я вне топа */}
      {data?.me && !entries.some((entry) => entry.isMe && entry.place <= 3) && (
        <Card className="sticky bottom-24 border-secondary/25">
          <Row entry={data.me} metric={metric} bare />
        </Card>
      )}
    </div>
  );
}

function Row({
  entry,
  metric,
  bare = false,
}: {
  entry: LeaderboardEntry;
  metric: LeaderboardMetric;
  bare?: boolean;
}): ReactElement {
  return (
    <div
      className={clsx(
        'flex items-center gap-3',
        !bare && 'glass-soft px-3 py-2.5',
        entry.isMe && !bare && 'ring-1 ring-secondary/40',
      )}
    >
      <span className="w-7 text-center font-display text-[13px] font-bold tabular-nums text-text-muted">
        {entry.place}
      </span>
      <Avatar src={entry.avatar} name={entry.name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">
          {entry.name} {entry.isMe && <span className="text-[11px] text-secondary">· вы</span>}
        </p>
        <p className="text-[11px] text-text-muted">Уровень {entry.level}</p>
      </div>
      <span className="font-display text-[14px] font-bold tabular-nums">
        {formatCompact(entry.value)} <span className="text-[11px] text-text-muted">{SUFFIX[metric]}</span>
      </span>
    </div>
  );
}
