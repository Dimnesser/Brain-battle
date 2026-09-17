import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  // .env лежит в корне монорепозитория, а не в web/
  const env = loadEnv(mode, resolve(process.cwd(), '..'), '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:4000';

  return {
    plugins: [react()],
    envDir: resolve(process.cwd(), '..'),
    resolve: {
      alias: {
        '@': resolve(process.cwd(), 'src'),
        '@nexus/shared': resolve(process.cwd(), '../shared/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      host: true,
      // Прокси нужен, когда VITE_API_URL не задан: фронт и API на одном origin
      proxy: {
        '/api': { target: apiUrl, changeOrigin: true },
        '/ws': { target: apiUrl.replace(/^http/, 'ws'), ws: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Разделяем вендоров: библиотеки кешируются между релизами приложения
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
              return 'motion';
            }
            if (id.includes('@tanstack')) return 'query';
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) return 'react';
            return 'vendor';
          },
        },
      },
    },
  };
});
