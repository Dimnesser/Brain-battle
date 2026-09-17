import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLeaderboard } from '../services/leaderboard.service.js';
import { auth, requireAuth } from '../plugins/auth.js';

const query = z.object({
  metric: z.enum(['wins', 'balance', 'cases', 'referrals']).default('wins'),
  limit: z.coerce.number().int().min(3).max(100).default(50),
});

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => {
    const { metric, limit } = query.parse(request.query ?? {});
    return getLeaderboard(metric, auth(request).userId, limit);
  });
}
