import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve('dist');
const rootPrefix = `${root}${path.sep}`;
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

async function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
  let target = path.resolve(root, pathname.replace(/^\/+/, ''));
  if (target !== root && !target.startsWith(rootPrefix)) return undefined;
  const info = await stat(target);
  if (info.isDirectory()) target = path.join(target, 'index.html');
  return (await stat(target)).isFile() ? target : undefined;
}

export default async function startBuiltDocumentationServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const target = await resolveRequest(req.url ?? '/');
      if (!target) throw new Error('not found');
      res.statusCode = 200;
      res.setHeader('Content-Type', mime.get(path.extname(target)) ?? 'application/octet-stream');
      if (req.method === 'HEAD') return res.end();
      createReadStream(target).on('error', () => res.destroy()).pipe(res);
    } catch {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(4321, '127.0.0.1', resolve);
  });

  return async () => {
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  };
}
