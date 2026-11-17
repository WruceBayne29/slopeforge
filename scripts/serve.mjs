// Serves the production build (dist/) on a free local port for the Playwright scripts.
import { preview } from 'vite';

export async function serveDist() {
  const server = await preview({ logLevel: 'silent', preview: { port: 5185, strictPort: false } });
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error('Could not start the preview server. Run `npm run build` first.');
  return { url, close: () => new Promise((resolve) => server.httpServer.close(resolve)) };
}
