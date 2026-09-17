import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { WITHDRAWAL_METHODS, formatCoins } from '@nexus/shared';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useToast } from '../store/toast';
import { Button, Card, SectionTitle, Skeleton } from '../components/ui';
import { PageHeader } from './Deposit';
import type { ReactElement } from 'react';

const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'На рассмотрении', tone: 'text-warning' },
  APPROVED: { label: 'Выплачено', tone: 'text-success' },
  REJECTED: { label: 'Отклонено', tone: 'text-danger' },
};

export function WithdrawPage(): ReactElement {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, refresh } = useAuth();
  const [method, setMethod] = useState<string>(WITHDRAWAL_METHODS[0].id);
  const [amount, setAmount] = useState('');
  const [requisites, setRequisites] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['withdrawal'], queryFn: () => api.withdrawal.list() });

  const create = useMutation({
    mutationFn: () => api.withdrawal.create({ amount: Number(amount), method, requisites }),
    onSuccess: () => {
      toast.success('Заявка создана и отправлена на проверку');
      setAmount('');
      setRequisites('');
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['withdrawal'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.humanMessage : 'Не удалось создать заявку'),
  });

  const min = data?.min ?? 1000;
  const feePercent = data?.feePercent ?? 0;
  const value = Number(amount || 0);
  const fee = Math.floor((value * feePercent) / 100);
  const valid = value >= min && value <= (user?.balance ?? 0) && requisites.trim().length >= 5;
  const selected = WITHDRAWAL_METHODS.find((item) => item.id === method) ?? WITHDRAWAL_METHODS[0];

  return (
    <div className="space-y-5">
      <PageHeader title="Вывод средств" subtitle={`Минимум ${formatCoins(min)} B`} />

      <Card>
        <p className="tile-title mb-2">Способ вывода</p>
        <div className="grid grid-cols-3 gap-2">
          {WITHDRAWAL_METHODS.map((item) => (
            <button
              key={item.id}
              onClick={() => setMethod(item.id)}
              className={`press rounded-2xl border px-2 py-3 text-[12px] font-semibold leading-tight transition ${
                method === item.id
                  ? 'border-transparent bg-gradient-to-r from-primary to-secondary text-white shadow-glow-sm'
                  : 'border-line/70 bg-white/[0.03] text-text-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="tile-title mb-2 mt-4">Сумма</p>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          placeholder={`от ${min} B`}
          className="input-field"
        />

        <p className="tile-title mb-2 mt-4">Реквизиты</p>
        <input
          value={requisites}
          onChange={(event) => setRequisites(event.target.value)}
          placeholder={selected.placeholder}
          className="input-field"
          autoComplete="off"
        />

        <div className="mt-4 space-y-1.5 rounded-2xl bg-white/[0.03] p-3 text-[13px]">
          <div className="flex justify-between">
            <span className="text-text-muted">Комиссия {feePercent}%</span>
            <span className="tabular-nums text-danger">-{formatCoins(fee)} B</span>
          </div>
          <div className="flex justify-between font-display font-bold">
            <span>К выплате</span>
            <span className="tabular-nums">{formatCoins(Math.max(0, value - fee))} B</span>
          </div>
        </div>

        <Button
          fullWidth
          size="lg"
          className="mt-4"
          disabled={!valid}
          loading={create.isPending}
          onClick={() => create.mutate()}
        >
          Вывести
        </Button>

        {value > (user?.balance ?? 0) && (
          <p className="mt-2 text-center text-[12px] text-danger">Недостаточно средств на балансе</p>
        )}
        <p className="mt-2 text-center text-[11px] leading-relaxed text-text-muted">
          Средства резервируются сразу и возвращаются при отклонении заявки.
        </p>
      </Card>

      <section>
        <SectionTitle title="Мои заявки" />
        {isLoading ? (
          <Skeleton className="h-16" />
        ) : (data?.items.length ?? 0) === 0 ? (
          <p className="px-1 py-4 text-center text-[13px] text-text-muted">Заявок пока нет</p>
        ) : (
          <div className="space-y-2">
            {data?.items.map((item) => {
              const status = STATUS[item.status] ?? { label: item.status, tone: 'text-text-muted' };
              return (
                <div key={item.id} className="glass-soft px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[14px] font-bold tabular-nums">
                      {formatCoins(item.amount)} B
                    </span>
                    <span className={`text-[11px] font-semibold ${status.tone}`}>{status.label}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-text-muted">
                    <span>{item.requisites}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  {item.comment && <p className="mt-1 text-[11px] text-text-muted">Комментарий: {item.comment}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
