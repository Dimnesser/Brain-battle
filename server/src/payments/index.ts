import { env } from '../env.js';
import { MockPaymentProvider } from './mock.provider.js';
import { TelegramPaymentProvider } from './telegram.provider.js';
import type { PaymentProvider } from './provider.js';

const registry = new Map<string, PaymentProvider>();

function register(provider: PaymentProvider): void {
  registry.set(provider.id, provider);
}

register(new MockPaymentProvider());
register(new TelegramPaymentProvider());

/** Активный провайдер из PAYMENT_PROVIDER. */
export function getPaymentProvider(id: string = env.PAYMENT_PROVIDER): PaymentProvider {
  const provider = registry.get(id);
  if (!provider) {
    throw new Error(
      `Неизвестный платёжный провайдер «${id}». Доступные: ${[...registry.keys()].join(', ')}`,
    );
  }
  return provider;
}

export function listPaymentProviders(): Array<{ id: string; title: string }> {
  return [...registry.values()].map((provider) => ({ id: provider.id, title: provider.title }));
}

export type { PaymentProvider } from './provider.js';
