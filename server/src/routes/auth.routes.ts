import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthResponse } from '@nexus/shared';
import { prisma } from '../db.js';
import { env, isProduction } from '../env.js';
import { errors } from '../errors.js';
import { signToken } from '../auth/jwt.js';
import { verifyInitData, type TelegramUserPayload } from '../auth/telegram.js';
import { toUserDto, touchLogin, upsertTelegramUser } from '../services/user.service.js';
import { attachReferral } from '../services/referral.service.js';
import { auth, requireAuth } from '../plugins/auth.js';

const bodySchema = z.object({
  initData: z.string().optional(),
  /** Только для разработки: вход без Telegram. */
  devTelegramId: z.union([z.string(), z.number()]).optional(),
  devUsername: z.string().max(32).optional(),
  startParam: z.string().max(64).optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/telegram', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    handler: async (request) => {
      const body = bodySchema.parse(request.body ?? {});

      let payload: TelegramUserPayload;
      let startParam = body.startParam;

      if (body.initData) {
        const parsed = verifyInitData(body.initData);
        payload = parsed.user;
        startParam = parsed.startParam ?? startParam;
      } else if (body.devTelegramId !== undefined) {
        // Дев-вход существует только вне продакшена и только при явном флаге
        if (isProduction || !env.ALLOW_DEV_AUTH) {
          throw errors.unauthorized('Вход без Telegram отключён');
        }
        const id = Number(body.devTelegramId);
        if (!Number.isSafeInteger(id) || id <= 0) throw errors.validation('Некорректный devTelegramId');
        payload = {
          id,
          first_name: body.devUsername ?? 'Dev',
          username: body.devUsername ?? `dev_${id}`,
          language_code: 'ru',
        };
      } else {
        throw errors.unauthorized('Нужен initData Telegram');
      }

      const { user, created, startBonus } = await upsertTelegramUser(payload, startParam);
      if (!created && startParam) await attachReferral(user.id, startParam);
      if (user.isBanned) throw errors.banned(user.banReason ?? undefined);

      await touchLogin(user.id);

      const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      const response: AuthResponse = {
        token: signToken({ sub: fresh.id, tg: fresh.telegramId.toString(), adm: fresh.isAdmin }),
        user: await toUserDto(fresh),
        ...(startBonus > 0 ? { startBonus } : {}),
      };

      request.log.info({ userId: fresh.id, created }, 'авторизация игрока');
      return response;
    },
  });

  app.get('/me', {
    preHandler: requireAuth,
    handler: async (request) => {
      const { userId } = auth(request);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      return { user: await toUserDto(user) };
    },
  });
}
