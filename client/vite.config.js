import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { processItem } from './scripts/sync-missing-images.js';

function autoImagePlugin() {
  return {
    name: 'auto-image-plugin',
    configureServer(server) {
      server.middlewares.use('/api/auto-image', async (req, res) => {
        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const name = url.searchParams.get('name');
          const id = url.searchParams.get('id') || 'temp-id';
          if (!name) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Missing name parameter' }));
          }
          const publicUrl = await processItem({ id, item_name: name });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, url: publicUrl }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), autoImagePlugin()],
});
