import { useQuery } from '@tanstack/react-query';
import { formatCoins } from '@nexus/shared';
import { api } from '../lib/api';
import { Card, SectionTitle, Skeleton, StatTile } from '../components/ui';
import type { ReactElement } from 'react';

export function AdminDashboard(): ReactElement {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.admin.stats() });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-[88px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <SectionTitle title="Игроки" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Всего" value={formatCoins(data.users.total)} />
          <StatTile label="Активны сегодня" value={formatCoins(data.users.activeToday)} tone="success" />
          <StatTile label="Новых сегодня" value={formatCoins(data.users.newToday)} tone="primary" />
          <StatTile label="Заблокировано" value={formatCoins(data.users.banned)} tone="danger" />
        </div>
      </section>

      <section>
        <SectionTitle title="Кейсы" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Открыто всего" value={formatCoins(data.cases.opened)} />
          <StatTile label="Открыто сегодня" value={formatCoins(data.cases.openedToday)} />
          <StatTile label="Оборот" value={`${formatCoins(data.cases.wagered)} B`} />
          <StatTile
            label="Маржа"
            value={`${formatCoins(data.cases.margin)} B`}
            tone={data.cases.margin >= 0 ? 'success' : 'danger'}
            hint={
              data.cases.wagered > 0
                ? `RTP ${((data.cases.paidOut / data.cases.wagered) * 100).toFixed(1)}%`
                : undefined
            }
          />
        </div>
      </section>

      <section>
        <SectionTitle title="Финансы" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Пополнений" value={`${formatCoins(data.finance.deposits)} B`} tone="success" />
          <StatTile label="Сегодня" value={`${formatCoins(data.finance.depositsToday)} B`} />
          <StatTile label="Выплачено" value={`${formatCoins(data.finance.withdrawalsPaid)} B`} />
          <StatTile
            label="Выводов в ожидании"
            value={`${formatCoins(data.finance.withdrawalsPending)} B`}
            tone="danger"
          />
        </div>
      </section>

      <section>
        <SectionTitle title="Выдано бонусов" />
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Бонусы" value={`${formatCoins(data.bonuses.granted)} B`} />
          <StatTile label="Промокоды" value={`${formatCoins(data.bonuses.promoGranted)} B`} />
          <StatTile label="Рефералы" value={`${formatCoins(data.bonuses.referralGranted)} B`} />
        </div>
      </section>

      <section>
        <SectionTitle title="Топ кейсов" />
        <Card className="p-0">
          {data.topCases.length === 0 ? (
            <p className="p-4 text-center text-[13px] text-text-muted">Открытий ещё не было</p>
          ) : (
            <div className="divide-y divide-white/5">
              {data.topCases.map((item, index) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 text-[13px] font-bold text-text-muted">{index + 1}</span>
                  <span className="flex-1 text-[14px] font-semibold">{item.name}</span>
                  <span className="text-[12px] text-text-muted">{formatCoins(item.opened)} откр.</span>
                  <span
                    className={`w-24 text-right font-display text-[13px] font-bold tabular-nums ${
                      item.margin >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {item.margin >= 0 ? '+' : ''}
                    {formatCoins(item.margin)} B
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
