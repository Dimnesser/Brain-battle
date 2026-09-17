import { createHmac, randomUUID } from 'node:crypto';
import { env } from '../env.js';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
  WebhookVerification,
} from './provider.js';

/**
 * Telegram Payments: сервер создаёт ссылку-инвойс через createInvoiceLink,
 * а подтверждение приходит от бота после successful_payment.
 */
export class TelegramPaymentProvider implements PaymentProvider {
  readonly id = 'telegram';
  readonly title = 'Telegram Payments';

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!env.BOT_TOKEN || !env.TELEGRAM_PROVIDER_TOKEN) {
      throw new Error('Для PAYMENT_PROVIDER=telegram нужны BOT_TOKEN и TELEGRAM_PROVIDER_TOKEN');
    }

    const providerRef = `tg_${randomUUID()}`;
    const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `Пополнение ${params.coins} B`,
        description: params.description,
        // payload возвращается обратно в successful_payment — по нему находим депозит
        payload: providerRef,
        provider_token: env.TELEGRAM_PROVIDER_TOKEN,
        currency: params.currency,
        prices: [{ label: `${params.coins} B`, amount: Math.round(params.amount * 100) }],
      }),
    });

    const data = (await response.json()) as { ok: boolean; result?: string; description?: string };
    if (!data.ok || !data.result) {
      throw new Error(`Telegram не создал инвойс: ${data.description ?? 'неизвестная ошибка'}`);
    }

    return { providerRef, payUrl: data.result, metadata: { invoice: true } };
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<WebhookVerification> {
    // Бот подписывает пересылаемое подтверждение общим секретом
    const signature = headers['x-payment-signature'];
    const provided = Array.isArray(signature) ? signature[0] : signature;
    if (!provided) return { ok: false, reason: 'Нет подписи' };

    const expected = createHmac('sha256', env.PAYMENT_SECRET).update(JSON.stringify(body ?? {})).digest('hex');
    if (provided !== expected) return { ok: false, reason: 'Подпись не совпадает' };

    const payload = body as { providerRef?: string; status?: string };
    if (!payload?.providerRef) return { ok: false, reason: 'Нет providerRef' };

    return { ok: true, providerRef: payload.providerRef, status: payload.status === 'FAILED' ? 'FAILED' : 'PAID' };
  }
}
