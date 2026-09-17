import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { claimBonus, getBonusOverview } from '../services/bonus.service.js';
import { auth, requireAuth } from '../plugins/auth.js';

const claimSchema = z.object({
  type: z.enum(['DAILY', 'STREAK', 'SUBSCRIPTION', 'REFERRAL_MILESTONE']),
});

export async function bonusRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => getBonusOverview(auth(request).userId));

  app.post('/claim', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: async (request) => {
      const { type } = claimSchema.parse(request.body ?? {});
      const { userId } = auth(request);
      const result = await claimBonus(userId, type);
      request.log.info({ userId, type, amount: result.amount }, 'выдан бонус');
      return result;
    },
  });
}
