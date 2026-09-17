import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { formatCoins } from '@nexus/shared';
import { ApiError, api } from '../lib/api';
import { useToast } from '../store/toast';
import { Button, Card, EmptyState, SectionTitle, Skeleton, Tabs } from '../components/ui';
import type { ReactElement } from 'react';

const TABS = [
  { id: 'PENDING', label: 'На рассмотрении' },
  { id: 'APPROVED', label: 'Одобренные' },
  { id: 'REJECTED', label: 'Отклонённые' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export function AdminFinance(): ReactElement {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('PENDING');
  const [comment, setComment] = useState('');

  const withdrawals = useQuery({
    queryKey: ['admin', 'withdrawals', tab],
    queryFn: () => api.admin.withdrawals(tab),
  });
  const deposits = useQuery({ queryKey: ['admin', 'deposits'], queryFn: () => api.admin.deposits() });

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? api.admin.approveWithdrawal(id, comment) : api.admin.rejectWithdrawal(id, comment),
    onSuccess: (_, variables) => {
      toast.success(variables.approve ? 'Вывод одобрен' : 'Вывод отклонён, средства возвращены');
      setComment('');
      refresh();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.humanMessage : 'Не удалось обработать заявку'),
  });

  return (
    <div className="space-y-5">
      <section>
        <SectionTitle title="Заявки на вывод" />
        <Tabs tabs={TABS} value={tab} onChange={setTab} />

        {tab === 'PENDING' && (
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Комментарий к решению (необязательно)"
            className="input-field mt-3"
          />
        )}

        <div className="mt-3 space-y-2">
          {withdrawals.isLoading ? (
            [0, 1].map((index) => <Skeleton key={index} className="h-[110px]" />)
          ) : (withdrawals.data?.items.length ?? 0) === 0 ? (
            <EmptyState icon="🏦" title="Заявок нет" />
          ) : (
            withdrawals.data?.items.map((item) => (
              <Card key={item.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-[15px] font-bold tabular-nums">
                      {formatCoins(item.amount)} B
                      <span className="ml-2 text-[11px] font-normal text-text-muted">
                        к выплате {formatCoins(item.payout)} B
                      </span>
                    </p>
                    <p className="text-[12px] text-text-muted">
                      {item.user.name} · TG {item.user.telegramId}
                    </p>
                    <p className="mt-1 break-all text-[12px]">
                      <span className="text-text-muted">{item.method}:</span>{' '}
                      <span className="font-semibold">{item.requisitesFull}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {new Date(item.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>

                  {item.status === 'PENDING' && (
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        loading={decide.isPending && decide.variables?.id === item.id && decide.variables.approve}
                        onClick={() => decide.mutate({ id: item.id, approve: true })}
                      >
                        Одобрить
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={decide.isPending && decide.variables?.id === item.id && !decide.variables.approve}
                        onClick={() => decide.mutate({ id: item.id, approve: false })}
                      >
                        Отклонить
                      </Button>
                    </div>
                  )}
                </div>
                {item.comment && <p className="mt-2 text-[11px] text-text-muted">Комментарий: {item.comment}</p>}
              </Card>
            ))
          )}
        </div>
      </section>

      <section>
        <SectionTitle title="Последние пополнения" />
        <Card className="p-0">
          {deposits.isLoading ? (
            <Skeleton className="h-20" />
          ) : (deposits.data?.items.length ?? 0) === 0 ? (
            <p className="p-4 text-center text-[13px] text-text-muted">Пополнений нет</p>
          ) : (
            <div className="divide-y divide-white/5">
              {deposits.data?.items.slice(0, 20).map((deposit) => (
                <div key={deposit.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{deposit.user.name}</p>
                    <p className="text-[11px] text-text-muted">
                      {deposit.provider} · {new Date(deposit.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <span className="font-display text-[13px] font-bold tabular-nums">
                    {formatCoins(deposit.amount)} B
                  </span>
                  <span
                    className={`w-16 text-right text-[11px] font-semibold ${
                      deposit.status === 'PAID'
                        ? 'text-success'
                        : deposit.status === 'PENDING'
                          ? 'text-warning'
                          : 'text-text-muted'
                    }`}
                  >
                    {deposit.status}
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
