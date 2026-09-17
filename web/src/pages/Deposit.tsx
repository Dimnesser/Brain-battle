import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEPOSIT_MAX, DEPOSIT_MIN, DEPOSIT_PRESETS, formatCoins } from '@nexus/shared';
import { ApiError, api } from '../lib/api';
import { openLink } from '../lib/telegram';
import { useToast } from '../store/toast';
import { Button, Card, SectionTitle, Skeleton } from '../components/ui';
import type { ReactElement } from 'react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает оплаты',
  PAID: 'Оплачено',
  FAILED: 'Отменено',
  EXPIRED: 'Истекло',
};

export function DepositPage(): ReactElement {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number>(DEPOSIT_PRESETS[1]);
  const [custom, setCustom] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['deposit'], queryFn: () => api.deposit.list() });

  const create = useMutation({
    mutationFn: (value: number) => api.deposit.create(value),
    onSuccess: ({ deposit }) => {
      void queryClient.invalidateQueries({ queryKey: ['deposit'] });
      if (deposit.payUrl) {
        toast.success('Платёж создан — переходим к оплате');
        openLink(deposit.payUrl);
      } else {
        toast.success('Платёж создан');
      }
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.humanMessage : 'Не удалось создать платёж'),
  });

  const value = custom ? Number(custom) : amount;
  const valid = Number.isFinite(value) && value >= DEPOSIT_MIN && value <= DEPOSIT_MAX;
  const bonusPercent = data?.bonusPercent ?? 0;
  const bonus = valid ? Math.floor((value * (data?.rate ?? 1) * bonusPercent) / 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Пополнение" subtitle="Быстро и без комиссии" />

      {bonusPercent > 0 && (
        <Card glow className="flex items-center gap-3">
          <span className="text-3xl">🎁</span>
          <div>
            <p className="tile-title">Бонус к пополнению</p>
            <p className="font-display text-lg font-extrabold text-gradient">+{bonusPercent}%</p>
          </div>
        </Card>
      )}

      <Card>
        <p className="tile-title mb-3">Сумма пополнения</p>

        <div className="grid grid-cols-4 gap-2">
          {DEPOSIT_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setAmount(preset);
                setCustom('');
              }}
              className={`press rounded-2xl border py-3 text-[14px] font-bold tabular-nums transition ${
                !custom && amount === preset
                  ? 'border-transparent bg-gradient-to-r from-primary to-secondary text-white shadow-glow-sm'
                  : 'border-line/70 bg-white/[0.03] text-text-muted'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <input
          value={custom}
          onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          placeholder={`Своя сумма (от ${DEPOSIT_MIN})`}
          className="input-field mt-3"
        />

        <div className="mt-4 space-y-1.5 rounded-2xl bg-white/[0.03] p-3 text-[13px]">
          <Row label="К зачислению" value={`${formatCoins(Math.floor(value * (data?.rate ?? 1)))} B`} />
          {bonus > 0 && <Row label={`Бонус ${bonusPercent}%`} value={`+${formatCoins(bonus)} B`} accent />}
          <div className="my-1 h-px bg-white/5" />
          <Row
            label="Итого"
            value={`${formatCoins(Math.floor(value * (data?.rate ?? 1)) + bonus)} B`}
            bold
          />
        </div>

        <Button
          fullWidth
          size="lg"
          className="mt-4"
          disabled={!valid}
          loading={create.isPending}
          onClick={() => create.mutate(value)}
        >
          Пополнить на {formatCoins(valid ? value : 0)} {data?.currency ?? ''}
        </Button>

        <p className="mt-2 text-center text-[11px] text-text-muted">
          Провайдер: {data?.providers.find((p) => p.id === data.activeProvider)?.title ?? '—'}
        </p>
      </Card>

      <section>
        <SectionTitle title="История пополнений" />
        {isLoading ? (
          <Skeleton className="h-16" />
        ) : (data?.items.length ?? 0) === 0 ? (
          <p className="px-1 py-4 text-center text-[13px] text-text-muted">Пополнений пока не было</p>
        ) : (
          <div className="space-y-2">
            {data?.items.map((deposit) => (
              <div key={deposit.id} className="glass-soft flex items-center gap-3 px-3 py-2.5">
                <span className="text-xl">💳</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">
                    {formatCoins(deposit.amount)} B
                    {deposit.bonusAmount > 0 && (
                      <span className="text-success"> +{formatCoins(deposit.bonusAmount)}</span>
                    )}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {new Date(deposit.createdAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    deposit.status === 'PAID'
                      ? 'text-success'
                      : deposit.status === 'PENDING'
                        ? 'text-warning'
                        : 'text-text-muted'
                  }`}
                >
                  {STATUS_LABELS[deposit.status] ?? deposit.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }): ReactElement {
  return (
    <div className="flex items-center gap-3 px-1">
      <Link to="/" className="press rounded-2xl bg-white/[0.06] p-2.5">
        <ArrowLeft size={18} />
      </Link>
      <div>
        <h1 className="font-display text-xl font-extrabold">{title}</h1>
        {subtitle && <p className="text-[12px] text-text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent = false,
  bold = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  bold?: boolean;
}): ReactElement {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={`tabular-nums ${accent ? 'text-success' : ''} ${bold ? 'font-display font-bold' : ''}`}>
        {value}
      </span>
    </div>
  );
}
