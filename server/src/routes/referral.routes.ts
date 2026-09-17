import type { FastifyInstance } from 'fastify';
import { getReferralOverview } from '../services/referral.service.js';
import { auth, requireAuth } from '../plugins/auth.js';

export async function referralRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  app.get('/', async (request) => getReferralOverview(auth(request).userId));
}
