import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { errors } from '../errors.js';
import { verifyToken } from '../auth/jwt.js';

export interface AuthContext {
  userId: string;
  telegramId: string;
  isAdmin: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();

  // WebSocket не умеет задавать заголовки — там токен приходит в query
  const query = request.query as Record<string, unknown> | undefined;
  const token = query?.token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/**
 * Обязательная авторизация.
 * Роль и права всегда перечитываются из БД: токен мог быть выдан до бана
 * или до снятия админских прав.
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractToken(request);
  if (!token) throw errors.unauthorized();

  const payload = verifyToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, telegramId: true, isAdmin: true, isBanned: true },
  });
  if (!user) throw errors.unauthorized('Пользователь не найден');
  if (user.isBanned) throw errors.banned();

  request.auth = {
    userId: user.id,
    telegramId: user.telegramId.toString(),
    isAdmin: user.isAdmin,
  };
}

/** Доступ к админ-API. Флаг из токена не используется — только актуальная БД. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);
  if (!request.auth?.isAdmin) throw errors.forbidden('Доступ только для администраторов');
}

/** Контекст авторизованного запроса (после requireAuth). */
export function auth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw errors.unauthorized();
  return request.auth;
}
