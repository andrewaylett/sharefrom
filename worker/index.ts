export interface Env {
  SIGNALING_SERVER: DurableObjectNamespace;
  ASSETS: Fetcher;
}

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://plausible.io",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '),
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function withSecurityHeaders(resp: Response): Response {
  const newHeaders = new Headers(resp.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    // Do not override CSP if already set
    if (k === 'Content-Security-Policy' && newHeaders.has(k)) continue;
    newHeaders.set(k, v);
  }
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: newHeaders,
  });
}

function isValidSessionId(id: string): boolean {
  // Allow URL-safe session identifiers up to 64 chars (covers UUIDs and test IDs)
  return /^[0-9A-Za-z_-]{1,64}$/.test(id);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket signaling requests
    if (url.pathname === '/api/signal/connect') {
      if (request.method !== 'GET') {
        return withSecurityHeaders(
          new Response('Method Not Allowed', { status: 405 }),
        );
      }

      const origin = request.headers.get('Origin');
      // Enforce same-origin for browser WebSocket upgrades when Origin is present
      if (origin) {
        try {
          const originUrl = new URL(origin);
          if (originUrl.host !== url.host) {
            return withSecurityHeaders(
              new Response('Forbidden', { status: 403 }),
            );
          }
        } catch {
          return withSecurityHeaders(
            new Response('Forbidden', { status: 403 }),
          );
        }
      }

      const sessionId = url.searchParams.get('session');
      if (!sessionId) {
        return withSecurityHeaders(
          new Response('Missing session ID', { status: 400 }),
        );
      }
      if (!isValidSessionId(sessionId)) {
        return withSecurityHeaders(
          new Response('Invalid session ID', { status: 400 }),
        );
      }

      // Get the Durable Object for this session
      const id = env.SIGNALING_SERVER.idFromName(sessionId);
      const stub = env.SIGNALING_SERVER.get(id);

      // Forward the request to the Durable Object
      const resp = await stub.fetch(request);
      // 101 Switching Protocols responses cannot append headers; return as-is
      if (resp.status === 101) return resp;
      return withSecurityHeaders(resp);
    }

    // Serve static assets for everything else
    const assetResp = await env.ASSETS.fetch(request);
    // Mutate headers in place to preserve response identity (important for tests)
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      if (k === 'Content-Security-Policy' && assetResp.headers.has(k)) continue;
      assetResp.headers.set(k, v);
    }
    return assetResp;
  },
};

export { SignalingServer } from './SignalingServer';
