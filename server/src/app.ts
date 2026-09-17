import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { ERROR_CODES } from '@nexus/shared';
import { corsOrigins, env, isProduction } from './env.js';
import { NexusLogController, loggerOptions } from './logger.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { authRoutes } from './routes/auth.routes.js';
import { transactionRoutes, userRoutes } from './routes/user.routes.js';
import { caseRoutes } from './routes/cases.routes.js';
import { bonusRoutes } from './routes/bonus.routes.js';
import { promoRoutes } from './routes/promo.routes.js';
import { referralRoutes } from './routes/referral.routes.js';
import { leaderboardRoutes } from './routes/leaderboard.routes.js';
import { depositRoutes, paymentWebhookRoutes, withdrawalRoutes } from './routes/payment.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { internalRoutes } from './routes/internal.routes.js';
import { realtimeRoutes } from './routes/ws.routes.js';
import { recentWins } from './services/case.service.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions,
    trustProxy: true,
    // Защита от гигантских тел запросов
    bodyLimit: 256 * 1024,
    // Fastify ожидает экземпляр контроллера, а не класс
    logController: new NexusLogController(),
  });

  // Заголовки безопасности. CSP для API не нужен, статику отдаёт nginx/vite
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: false });

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    global: true,
    max: 240,
    timeWindow: '1 minute',
    // Ключ — игрок, если он авторизован, иначе IP
    keyGenerator: (request) => request.auth?.userId ?? request.ip,
    errorResponseBuilder: () => ({
      error: { code: ERROR_CODES.RATE_LIMIT, message: 'Слишком много запросов. Попробуйте позже' },
    }),
  });

  await app.register(websocket);

  registerErrorHandler(app);

  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(userRoutes, { prefix: '/user' });
      await api.register(transactionRoutes, { prefix: '/transactions' });
      await api.register(caseRoutes, { prefix: '/cases' });
      await api.register(bonusRoutes, { prefix: '/bonus' });
      await api.register(promoRoutes, { prefix: '/promo' });
      await api.register(referralRoutes, { prefix: '/referrals' });
      await api.register(leaderboardRoutes, { prefix: '/leaderboard' });
      await api.register(depositRoutes, { prefix: '/deposit' });
      await api.register(withdrawalRoutes, { prefix: '/withdrawal' });
      await api.register(paymentWebhookRoutes, { prefix: '/payments/webhook' });
      await api.register(adminRoutes, { prefix: '/admin' });
      await api.register(internalRoutes, { prefix: '/internal' });

      // Публичная лента выигрышей — без приватных данных
      api.get('/wins', async () => ({ items: await recentWins(20) }));
    },
    { prefix: '/api' },
  );

  await app.register(realtimeRoutes, { prefix: '/ws' });

  app.log.info(
    { env: env.NODE_ENV, provider: env.PAYMENT_PROVIDER, devAuth: env.ALLOW_DEV_AUTH },
    'приложение собрано',
  );

  return app;
}
