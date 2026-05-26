import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/client'),
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env['DASHBOARD_CLIENT_PORT'] ?? 3700),
    proxy: {
      // Orchestrator routes — must be listed before the catch-all /api
      '/api/v1': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/state': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/interactions': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/chat': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/plans': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/analyze': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/roadmap': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/dispatch': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/sessions': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/streams': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/analyses': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/api/maintenance': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `http://localhost:${process.env['ORCHESTRATOR_PORT'] ?? '8080'}`,
        ws: true,
      },
      // Dashboard API — catch-all for remaining /api routes (must be last)
      '/api': {
        target: `http://localhost:${process.env['DASHBOARD_API_PORT'] ?? '3701'}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    // Syntax-highlighter bundles Prism + every language grammar, so it
    // inherently exceeds the default 500 kB warn. Bumped to 700 kB so
    // legitimate growth elsewhere still triggers the warning.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('react-syntax-highlighter') ||
            id.includes('refractor') ||
            id.includes('prismjs')
          ) {
            return 'syntax-highlighter';
          }
          if (id.includes('framer-motion')) return 'framer-motion';
          if (id.includes('react-virtuoso')) return 'virtuoso';
          if (id.includes('react-router')) return 'react-router';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react';
          }
          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
