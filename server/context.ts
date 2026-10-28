import { keyedHash } from './crypto.js';
import { clientIp } from './http.js';

export interface Ctx {
  request: Request;
  url: URL;
  params: string[];
  ip: string;
  ipHash: () => string;
}

export function makeCtx(request: Request, url: URL, params: string[]): Ctx {
  const ip = clientIp(request);
  let hashed: string | null = null;
  return { request, url, params, ip, ipHash: () => (hashed ??= keyedHash('ip', ip)) };
}
