import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fetchAggregatedCryptoNews, fetchUsdMacroCalendar } from './api/_lib/feeds';

function localApiDevPlugin(): Plugin {
  return {
    name: 'local-api-dev-routes',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const reqUrl = (req as { url?: string }).url;
        if (reqUrl?.startsWith('/api/news')) {
          try {
            const items = await fetchAggregatedCryptoNews();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 200;
            res.end(JSON.stringify({ items, fetchedAt: Date.now() }));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 502;
            res.end(JSON.stringify({ error: String(err), items: [] }));
          }
          return;
        }
        if (reqUrl?.startsWith('/api/calendar')) {
          try {
            const events = await fetchUsdMacroCalendar();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 200;
            res.end(JSON.stringify({ events, fetchedAt: Date.now() }));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 502;
            res.end(JSON.stringify({ error: String(err), events: [] }));
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApiDevPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
