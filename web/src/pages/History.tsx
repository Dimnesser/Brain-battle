import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { TRANSACTION_LABELS, formatCoins } from '@nexus/shared';
import { api } from '../lib/api';
import { EmptyState, Skeleton, Tabs } from '../components/ui';
import { PageHeader } from './Deposit';
import type { ReactElement } from 'react';

const TABS = [
  { id: 'ALL', label: 'Все' },
  { id: 'DEPOSIT', label: 'Пополнения' },
  { id: 'CASE_REWARD', label: 'Выигрыши' },
  { id: 'BONUS', label: 'Бонусы' },
  { id: 'WITHDRAWAL', label: 'Выводы' },
] as const;

type Tab = (typeof TABS)[number]['id'];

const ICONS: Record<string, string> = {
  DEPOSIT: '💳',
  WITHDRAWAL: '🏦',
  WITHDRAWAL_REFUND: '↩️',
  CASE_PURCHASE: '🎁',
  CASE_REWARD: '💎',
  BONUS: '🎯',
  PROMO: '🎟',
  REFERRAL: '👥',
  ADMIN_ADJUST: '🛠',
};

export function HistoryPage(): ReactElement {
  const [tab, setTab] = useState<Tab>('ALL');
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', tab],
    queryFn: () => api.user.transactions(tab),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="История" subtitle="Все операции по балансу" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[62px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="📜" title="Операций нет" hint="Здесь появятся пополнения, выигрыши и бонусы" />
      ) : (
        <div className="space-y-2">
          {items.map((transaction) => (
            <div key={transaction.id} className="glass-soft flex items-center gap-3 px-3 py-2.5">
              <span className="text-xl">{ICONS[transaction.type] ?? '•'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">
                  {transaction.description ?? TRANSACTION_LABELS[transaction.type] ?? transaction.type}
                </p>
                <p className="text-[11px] text-text-muted">
                  {new Date(transaction.createdAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · остаток '}
                  {formatCoins(transaction.balanceAfter)} B
                </p>
              </div>
              <span
                className={`font-display text-[14px] font-bold tabular-nums ${
                  transaction.amount > 0 ? 'text-success' : transaction.amount < 0 ? 'text-danger' : 'text-text-muted'
                }`}
              >
                {transaction.amount > 0 ? '+' : ''}
                {formatCoins(transaction.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
