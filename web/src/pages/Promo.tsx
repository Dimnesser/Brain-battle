import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { formatCoins } from '@nexus/shared';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useToast } from '../store/toast';
import { hapticNotify } from '../lib/telegram';
import { Button, Card } from '../components/ui';
import { PageHeader } from './Deposit';
import type { ReactElement } from 'react';

export function PromoPage(): ReactElement {
  const toast = useToast();
  const { patchUser, refresh } = useAuth();
  const [code, setCode] = useState('');

  const redeem = useMutation({
    mutationFn: () => api.promo.redeem(code.trim()),
    onSuccess: (result) => {
      patchUser({ balance: result.balance });
      toast.success(result.message);
      hapticNotify('success');
      setCode('');
      void refresh();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.humanMessage : 'Промокод не принят');
      hapticNotify('error');
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Промокод" subtitle="Введите код и получите награду" />

      <Card glow className="text-center">
        <div className="text-5xl">🎟</div>
        <h2 className="mt-2 font-display text-lg font-bold uppercase tracking-wide">Активация промокода</h2>
        <p className="mt-1 text-[13px] text-text-muted">Промокоды публикуются в нашем канале</p>

        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
          placeholder="ВВЕДИТЕ ПРОМОКОД"
          maxLength={32}
          autoCapitalize="characters"
          autoComplete="off"
          className="input-field mt-4 text-center font-display text-lg font-bold tracking-[0.2em]"
        />

        <Button
          fullWidth
          size="lg"
          className="mt-3"
          disabled={code.trim().length < 3}
          loading={redeem.isPending}
          onClick={() => redeem.mutate()}
        >
          Активировать
        </Button>

        {redeem.data && (
          <p className="mt-3 animate-fade-up text-[13px] font-semibold text-success">
            {redeem.data.type === 'BALANCE'
              ? `Зачислено ${formatCoins(redeem.data.amount)} B`
              : redeem.data.message}
          </p>
        )}
      </Card>

      <Card>
        <p className="tile-title mb-2">Как это работает</p>
        <ul className="space-y-2 text-[13px] leading-relaxed text-text-muted">
          <li>• Промокод даёт монеты, XP или процент к пополнению</li>
          <li>• Каждый код можно активировать ограниченное число раз</li>
          <li>• Процент к пополнению применяется к следующему платежу</li>
        </ul>
      </Card>
    </div>
  );
}
