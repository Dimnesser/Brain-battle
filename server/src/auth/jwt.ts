import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env.js';
import { errors } from '../errors.js';

export interface TokenPayload {
  sub: string;
  tg: string;
  adm: boolean;
}

export function signToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'nexus',
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'nexus' });
    if (typeof decoded === 'string') throw new Error('bad payload');
    const { sub, tg, adm } = decoded as jwt.JwtPayload & Partial<TokenPayload>;
    if (!sub || !tg) throw new Error('bad payload');
    return { sub, tg, adm: Boolean(adm) };
  } catch {
    throw errors.unauthorized('Сессия истекла, откройте приложение заново');
  }
}
