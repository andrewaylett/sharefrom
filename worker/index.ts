export interface Env {
  SIGNALING_SERVER: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle signaling API requests
    if (url.pathname.startsWith('/api/signal')) {
      // Will be implemented in sharefrom-4
      return new Response('Signaling API - not yet implemented', { status: 501 });
    }

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
};

export class SignalingServer {
  // Will be implemented in sharefrom-4
}
