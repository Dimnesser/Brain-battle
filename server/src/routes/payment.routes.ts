import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DEPOSIT_MAX, DEPOSIT_MIN, WITHDRAWAL_METHODS } from '@nexus/shared';
import { env } from '../env.js';
import { errors } from '../errors.js';
import { auth, requireAuth } from '../plugins/auth.js';
import { getPaymentProvider, listPaymentProviders } from '../payments/index.js';
import {
  createDeposit,
  depositBonusPercent,
  listDeposits,
  markDepositFailed,
  markDepositPaid,
} from '../services/deposit.service.js';
import { createWithdrawal, listWithdrawals } from '../services/withdrawal.service.js';

const depositSchema = z.object({
  amount: z.coerce.number().int().min(DEPOSIT_MIN).max(DEPOSIT_MAX),
});

const withdrawalSchema = z.object({
  amount: z.coerce.number().int().positive(),
  method: z.enum(['card', 'sbp', 'crypto']),
  requisites: z.string().min(5).max(120),
});

export async function depositRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => {
    const { userId } = auth(request);
    return {
      items: await listDeposits(userId),
      bonusPercent: await depositBonusPercent(userId),
      providers: listPaymentProviders(),
      activeProvider: env.PAYMENT_PROVIDER,
      currency: env.PAYMENT_CURRENCY,
      rate: env.COINS_PER_CURRENCY_UNIT,
    };
  });

  app.post('/', {
    config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
    handler: async (request) => {
      const { amount } = depositSchema.parse(request.body ?? {});
      const { userId } = auth(request);
      const deposit = await createDeposit(userId, amount);
      // В логи попадает только идентификатор — никаких платёжных данных
      request.log.info({ userId, depositId: deposit.id, amount: deposit.amount }, 'создан платёж');
      return { deposit };
    },
  });
}

export async function withdrawalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => ({
    items: await listWithdrawals(auth(request).userId),
    min: env.WITHDRAWAL_MIN,
    feePercent: env.WITHDRAWAL_FEE_PERCENT,
    methods: WITHDRAWAL_METHODS,
  }));

  app.post('/', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
    handler: async (request) => {
      const body = withdrawalSchema.parse(request.body ?? {});
      const { userId } = auth(request);

      const withdrawal = await createWithdrawal({
        userId,
        amount: body.amount,
        method: body.method,
        requisites: body.requisites,
      });

      request.log.info(
        { userId, withdrawalId: withdrawal.id, amount: withdrawal.amount, method: withdrawal.method },
        'заявка на вывод',
      );
      return { withdrawal };
    },
  });
}

/** Webhook платёжного провайдера. Публичный маршрут — защищён подписью провайдера. */
export async function paymentWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/:provider', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      const { provider: providerId } = z.object({ provider: z.string().max(32) }).parse(request.params);

      const provider = getPaymentProvider(providerId);
      const verification = await provider.verifyWebhook(request.headers, request.body);

      if (!verification.ok || !verification.providerRef) {
        request.log.warn({ providerId, reason: verification.reason }, 'отклонён webhook платежа');
        throw errors.forbidden('Подпись webhook не прошла проверку');
      }

      if (verification.status === 'FAILED') {
        await markDepositFailed(providerId, verification.providerRef);
        return reply.send({ ok: true, status: 'FAILED' });
      }

      const credited = await markDepositPaid(providerId, verification.providerRef);
      request.log.info({ providerId, credited }, 'подтверждение платежа');
      return reply.send({ ok: true, credited });
    },
  });
}
