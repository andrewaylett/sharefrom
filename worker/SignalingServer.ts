interface Session {
  laptopWs: WebSocket | null;
  phoneWs: WebSocket | null;
  createdAt: number;
  lastActivityAt: number;
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer-disconnected';
  payload?: unknown;
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export class SignalingServer {
  private sessions: Map<string, Session>;
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();

    // Set up periodic cleanup every minute
    void this.state.blockConcurrencyWhile(async () => {
      const alarm = await this.state.storage.getAlarm();
      if (!alarm) {
        await this.state.storage.setAlarm(Date.now() + 60_000); // 1 minute
      }
    });
  }

  async alarm() {
    // Clean up expired sessions
    const now = Date.now();
    const sessionsToDelete: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt > SESSION_TIMEOUT_MS) {
        console.log(`Cleaning up expired session: ${sessionId}`);

        // Close any open WebSocket connections
        if (session.laptopWs) {
          session.laptopWs.close(1000, 'Session expired');
        }
        if (session.phoneWs) {
          session.phoneWs.close(1000, 'Session expired');
        }

        sessionsToDelete.push(sessionId);
      }
    }

    for (const sessionId of sessionsToDelete) {
      this.sessions.delete(sessionId);
    }

    // Schedule next cleanup
    await this.state.storage.setAlarm(Date.now() + 60_000);
  }

  fetch(request: Request): Response {
    const url = new URL(request.url);

    // Get session ID from query parameter
    const sessionId = url.searchParams.get('session');
    if (!sessionId) {
      return new Response('Missing session ID', { status: 400 });
    }
    // Validate UUID v4 format (defense-in-depth)
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        sessionId,
      )
    ) {
      return new Response('Invalid session ID', { status: 400 });
    }

    // Check for WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Get or create session
    let session = this.sessions.get(sessionId);
    if (!session) {
      const now = Date.now();
      session = {
        laptopWs: null,
        phoneWs: null,
        createdAt: now,
        lastActivityAt: now,
      };
      this.sessions.set(sessionId, session);
    }

    // Update last activity
    session.lastActivityAt = Date.now();

    // Determine if this is laptop or phone connection
    // First connection is laptop, second is phone
    const isLaptop = session.laptopWs === null;

    if (isLaptop) {
      session.laptopWs = server;
      this.handleWebSocket(server, sessionId, 'laptop');
    } else if (session.phoneWs === null) {
      session.phoneWs = server;
      this.handleWebSocket(server, sessionId, 'phone');
    } else {
      return new Response('Session already has both connections', {
        status: 409,
      });
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleWebSocket(
    ws: WebSocket,
    sessionId: string,
    role: 'laptop' | 'phone',
  ) {
    ws.accept();

    ws.addEventListener('message', (event) => {
      this.handleMessage(sessionId, role, event.data as string);
    });

    ws.addEventListener('close', () => {
      this.handleClose(sessionId, role);
    });

    ws.addEventListener('error', () => {
      this.handleClose(sessionId, role);
    });

    // Send ready message to confirm connection
    ws.send(JSON.stringify({ type: 'connected', role }));
  }

  private handleMessage(
    sessionId: string,
    sender: 'laptop' | 'phone',
    data: string,
  ) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Update last activity on message
    session.lastActivityAt = Date.now();

    try {
      // Parse and validate the message
      JSON.parse(data) as SignalingMessage;

      // Relay message to the other peer
      const targetWs = sender === 'laptop' ? session.phoneWs : session.laptopWs;

      if (targetWs && targetWs.readyState === WebSocket.READY_STATE_OPEN) {
        targetWs.send(data);
      }
    } catch (error) {
      console.error('Failed to parse signaling message:', error);
    }
  }

  private handleClose(sessionId: string, role: 'laptop' | 'phone') {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear the closed connection
    if (role === 'laptop') {
      session.laptopWs = null;
    } else {
      session.phoneWs = null;
    }

    // Notify the other peer
    const otherWs = role === 'laptop' ? session.phoneWs : session.laptopWs;
    if (otherWs && otherWs.readyState === WebSocket.READY_STATE_OPEN) {
      otherWs.send(JSON.stringify({ type: 'peer-disconnected' }));
      otherWs.close(1000, 'Other peer disconnected');
    }

    // Clean up session if both connections are closed
    if (!session.laptopWs && !session.phoneWs) {
      this.sessions.delete(sessionId);
    }
  }
}
