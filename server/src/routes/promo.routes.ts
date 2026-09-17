import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { redeemPromo } from '../services/promo.service.js';
import { auth, requireAuth } from '../plugins/auth.js';

const redeemSchema = z.object({ code: z.string().min(3).max(32) });

export async function promoRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/redeem', {
    // Перебор промокодов — частый вектор злоупотребления
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: async (request) => {
      const { code } = redeemSchema.parse(request.body ?? {});
      const { userId } = auth(request);
      const result = await redeemPromo(userId, code);
      request.log.info({ userId, code: result.code, amount: result.amount }, 'активация промокода');
      return result;
    },
  });
}
