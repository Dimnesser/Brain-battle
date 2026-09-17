import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getCaseDetail, listCases, openCase, recentWins } from '../services/case.service.js';
import { auth, requireAuth } from '../plugins/auth.js';

const listQuery = z.object({
  category: z.enum(['POPULAR', 'PREMIUM', 'REGULAR', 'THEMATIC', 'FREE']).optional(),
});

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

export async function caseRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => {
    const query = listQuery.parse(request.query ?? {});
    const items = await listCases(auth(request).userId, query.category);
    return { items };
  });

  app.get('/wins', async () => ({ items: await recentWins(20) }));

  app.get('/:id', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    return { case: await getCaseDetail(auth(request).userId, id) };
  });

  app.post('/:id/open', {
    // Открытие кейса — самая дорогая операция, ограничиваем жёстче общего лимита
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    handler: async (request) => {
      const { id } = paramsSchema.parse(request.params);
      const { userId } = auth(request);

      const result = await openCase({ userId, caseId: id });

      request.log.info(
        {
          userId,
          caseId: result.opening.caseId,
          price: result.opening.price,
          amount: result.opening.amount,
        },
        'открытие кейса',
      );

      return result;
    },
  });
}
