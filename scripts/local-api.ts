/**
 * Local development server for the assessment API. Runs the same `handle`
 * function that Vercel serves from api/v1.ts. Vite proxies /api to it.
 *
 *   npm run api:dev            (reads .env.local)
 *   ENV_FILE=.env.test npm run api:dev
 */
import { createServer, type IncomingMessage } from 'node:http';
import { existsSync } from 'node:fs';

const envFile = process.env.ENV_FILE ?? '.env.local';
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { handle } = await import('../server/router.js');
const port = Number(process.env.API_PORT ?? 8787);

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
    else if (value !== undefined) headers.set(name, value);
  }
  // Vercel sets these itself; locally, a client could send them to dodge rate
  // limits. The scenario tests opt in so each test candidate gets its own IP.
  const testIp = process.env.LOCAL_API_TRUST_TEST_IP === '1' ? headers.get('x-test-client-ip') : null;
  headers.delete('x-vercel-forwarded-for');
  headers.delete('x-forwarded-for');
  headers.delete('x-test-client-ip');
  headers.set('x-real-ip', testIp ?? req.socket.remoteAddress ?? '127.0.0.1');
  const method = req.method ?? 'GET';
  return new Request(`http://${req.headers.host ?? `localhost:${port}`}${req.url ?? '/'}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  });
}

createServer(async (req, res) => {
  try {
    const response = await handle(await toRequest(req));
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error('[local-api]', err instanceof Error ? err.message : err);
    res.statusCode = 500;
    res.end();
  }
}).listen(port, () => console.log(`Assessment API on http://localhost:${port}/api/v1`));
