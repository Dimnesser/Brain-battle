import type { FastifyInstance } from 'fastify';
import { hub } from '../realtime/hub.js';

/**
 * Живая лента выигрышей.
 * Канал только на чтение: сервер не принимает от клиента никаких команд,
 * поэтому подключение не требует авторизации и не раскрывает приватных данных.
 */
export async function realtimeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { websocket: true }, (socket) => {
    const remove = hub.add({ send: (data: string) => socket.send(data) });

    socket.on('close', remove);
    socket.on('error', remove);
    // Входящие сообщения игнорируются намеренно
    socket.on('message', () => {});
  });
}
