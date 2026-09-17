import { buildApp } from './app.js';
import { prisma } from './db.js';
import { env } from './env.js';

async function main(): Promise<void> {
  const app = await buildApp();

  // Проверяем БД до открытия порта: лучше не стартовать, чем отдавать 500
  try {
    await prisma.$queryRaw`SELECT 1`;
    app.log.info('подключение к базе данных установлено');
  } catch (error) {
    app.log.error({ err: error }, 'нет подключения к базе данных — проверьте DATABASE_URL');
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'остановка сервера');
    try {
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'ошибка при остановке');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => app.log.error({ err: reason }, 'необработанный reject'));

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`NEXUS API слушает http://${env.HOST}:${env.PORT}`);
}

main().catch((error) => {
  console.error('Не удалось запустить сервер:', error);
  process.exit(1);
});
