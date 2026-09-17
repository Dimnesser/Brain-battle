import { randomUUID } from 'node:crypto';
import { env } from '../env.js';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
  WebhookVerification,
} from './provider.js';

/**
 * Тестовый провайдер для локальной разработки.
 * Выдаёт ссылку на страницу-заглушку и подтверждает оплату по webhook-у
 * с общим секретом PAYMENT_SECRET.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock';
  readonly title = 'Тестовая оплата';

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const providerRef = `mock_${randomUUID()}`;
    return {
      providerRef,
      payUrl: `${env.WEBAPP_URL.replace(/\/$/, '')}/payment/mock?ref=${providerRef}&amount=${params.amount}`,
      metadata: { sandbox: true },
    };
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<WebhookVerification> {
    const secret = headers['x-payment-secret'];
    const provided = Array.isArray(secret) ? secret[0] : secret;
    if (!provided || provided !== env.PAYMENT_SECRET) return { ok: false, reason: 'Неверная подпись webhook' };

    const payload = body as { providerRef?: string; status?: string };
    if (!payload?.providerRef) return { ok: false, reason: 'Нет providerRef' };

    const status = payload.status === 'FAILED' ? 'FAILED' : 'PAID';
    return { ok: true, providerRef: payload.providerRef, status };
  }
}
