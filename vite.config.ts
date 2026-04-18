import { defineConfig, type Plugin } from 'vite';

import path from 'path';
import { assetpackPlugin } from './vite.plugin.assetpack';

function fullReloadOnTsChange(): Plugin {
  return {
    name: 'full-reload-on-ts-change',
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.ts')) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: {
    minify: 'esbuild',
  },
  plugins: [fullReloadOnTsChange(), assetpackPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
    strictPort: true,
    host: process.env.HOST ?? 'localhost',
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
});
