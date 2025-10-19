import { SignalingServer } from './SignalingServer'

export interface Env {
  SIGNALING_SERVER: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket signaling requests
    if (url.pathname === '/api/signal/connect') {
      const sessionId = url.searchParams.get('session')
      if (!sessionId) {
        return new Response('Missing session ID', { status: 400 })
      }

      // Get the Durable Object for this session
      const id = env.SIGNALING_SERVER.idFromName(sessionId)
      const stub = env.SIGNALING_SERVER.get(id)
      
      // Forward the request to the Durable Object
      return stub.fetch(request)
    }

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
};

export { SignalingServer }
