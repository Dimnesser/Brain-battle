import { BOT_COMMANDS, createBot } from './bot.js';
import { prisma } from './db.js';
import { env } from './env.js';
import { startNotifier } from './notifier.js';

async function main(): Promise<void> {
  const bot = createBot();

  await prisma.$queryRaw`SELECT 1`;
  console.log('[bot] подключение к базе данных установлено');

  await bot.api.setMyCommands(BOT_COMMANDS);

  const stopNotifier = startNotifier(bot);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[bot] остановка (${signal})`);
    stopNotifier();
    await bot.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  console.log(`[bot] запуск @${env.BOT_USERNAME}, WebApp: ${env.WEBAPP_URL}`);
  // long polling: для вебхуков достаточно заменить на bot.api.setWebhook
  await bot.start({ onStart: (info) => console.log(`[bot] авторизован как @${info.username}`) });
}

main().catch((error) => {
  console.error('[bot] не удалось запустить:', error);
  process.exit(1);
});
