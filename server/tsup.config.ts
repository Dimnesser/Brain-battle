import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Пакет из workspace должен попасть в бандл, а не остаться внешней ссылкой
  noExternal: ['@nexus/shared'],
  outExtension: () => ({ js: '.cjs' }),
});
