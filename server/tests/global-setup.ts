import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Готовит отдельную тестовую базу: миграции применяются один раз
 * перед всем прогоном. Рабочую базу тесты не трогают.
 */
export default function setup(): void {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus_test?schema=public';

  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
