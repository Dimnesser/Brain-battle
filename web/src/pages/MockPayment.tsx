import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { API_URL } from '../lib/api';
import { useToast } from '../store/toast';
import { Button, Card } from '../components/ui';
import { PageHeader } from './Deposit';
import type { ReactElement } from 'react';

/**
 * Страница-заглушка тестового платёжного провайдера.
 * Нужна только для локальной разработки: реальный провайдер
 * присылает подтверждение webhook-ом со своей стороны.
 */
export function MockPaymentPage(): ReactElement {
  const [params] = useSearchParams();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const ref = params.get('ref') ?? '';
  const amount = params.get('amount') ?? '0';

  const confirm = async (): Promise<void> => {
    toast.show('Подтверждение оплаты выполняется на стороне провайдера', 'info');
    setDone(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Тестовая оплата" subtitle="Режим разработки" />

      <Card glow className="text-center">
        <div className="text-5xl">🧪</div>
        <p className="mt-2 font-display text-lg font-bold">Платёж на {amount}</p>
        <p className="mt-1 break-all text-[11px] text-text-muted">ref: {ref || '—'}</p>

        <div className="mt-4 rounded-2xl bg-white/[0.04] p-3 text-left text-[12px] leading-relaxed text-text-muted">
          Подтвердите платёж запросом к API:
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-black/40 p-2 text-[10px] text-text">
{`curl -X POST ${API_URL || 'http://localhost:4000'}/api/payments/webhook/mock \\
  -H 'content-type: application/json' \\
  -H 'x-payment-secret: $PAYMENT_SECRET' \\
  -d '{"providerRef":"${ref}","status":"PAID"}'`}
          </pre>
        </div>

        <Button fullWidth className="mt-4" variant="ghost" onClick={confirm} disabled={done}>
          Понятно
        </Button>
      </Card>
    </div>
  );
}
