/**
 * Абстракция платёжного провайдера.
 *
 * Бизнес-логика знает только про этот интерфейс. Чтобы подключить YooKassa,
 * крипто-эквайринг или Telegram Payments, достаточно добавить реализацию
 * и зарегистрировать её в registry — код депозитов не меняется.
 */

export interface CreatePaymentParams {
  depositId: string;
  userId: string;
  telegramId: string;
  /** Сумма во внутренней валюте (B). */
  coins: number;
  /** Сумма к оплате в фиате/крипте. */
  amount: number;
  currency: string;
  description: string;
}

export interface CreatePaymentResult {
  /** Идентификатор платежа на стороне провайдера. */
  providerRef: string;
  /** Ссылка/инвойс для оплаты. */
  payUrl: string | null;
  /** Произвольные данные провайдера — сохраняются в deposits.metadata. */
  metadata?: Record<string, unknown>;
  /** Провайдер подтвердил оплату сразу (например, тестовый режим). */
  paidImmediately?: boolean;
}

export interface WebhookVerification {
  ok: boolean;
  /** Идентификатор платежа провайдера. */
  providerRef?: string;
  status?: 'PAID' | 'FAILED' | 'PENDING';
  reason?: string;
}

export interface PaymentProvider {
  readonly id: string;
  readonly title: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  /** Проверка подписи и разбор входящего webhook-а. Тело — сырой JSON. */
  verifyWebhook(headers: Record<string, string | string[] | undefined>, body: unknown): Promise<WebhookVerification>;
}
