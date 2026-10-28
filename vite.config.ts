import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The assessment portal is a separate page with its own small router.
// These paths must match the rewrites in vercel.json.
const ASSESSMENT_ROUTES = /^\/(customer-support-assessment(\/|$)|verify-certificate\/)/;

function assessmentFallback(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url && ASSESSMENT_ROUTES.test(req.url.split('?')[0]) && !/\.[a-z0-9]+$/i.test(req.url.split('?')[0])) {
      req.url = '/assessment.html';
    }
    next();
  };
  return {
    name: 'assessment-fallback',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

export default defineConfig({
  plugins: [react(), assessmentFallback()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', assessment: 'assessment.html' },
    },
  },
  server: {
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8787}` },
  },
  preview: {
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8787}` },
  },
});
