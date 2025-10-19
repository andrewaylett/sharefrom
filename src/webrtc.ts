// WebRTC configuration
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

export class WebRTCConnection {
  pc: RTCPeerConnection | null = null;
  ws: WebSocket | null = null;
  dataChannel: RTCDataChannel | null = null;
  private sessionId: string;
  private reconnectAttempts = 0;
  private onFileReceived?: (file: File) => void;
  private onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  private onError?: (error: unknown) => void;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async connect(): Promise<void> {
    // Connect to signaling server
    const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${globalThis.location.host}/api/signal/connect?session=${this.sessionId}`;

    this.ws = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      const connectTimeout = setTimeout(() => {
        reject(
          new Error(
            'Connection timeout - please check your internet connection',
          ),
        );
      }, 10_000);

      const addWsListener = <K extends keyof WebSocketEventMap>(
        type: K,
        handler: (this: WebSocket, event: WebSocketEventMap[K]) => void,
      ) => {
        const wsAny = this.ws;
        if (wsAny && typeof wsAny.addEventListener === 'function') {
          // Use standard event listener when available
          wsAny.addEventListener(type, handler);
        } else if (wsAny) {
          // Fallback for test mocks that don't support addEventListener
          const prop =
            type === 'message'
              ? 'onmessage'
              : type === 'error'
                ? 'onerror'
                : type === 'close'
                  ? 'onclose'
                  : 'onopen';
          (wsAny as unknown as Record<string, unknown>)[prop] = handler;
        }
      };

      addWsListener('open', () => {
        clearTimeout(connectTimeout);
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.setupPeerConnection();
        resolve();
      });

      addWsListener('error', (event) => {
        clearTimeout(connectTimeout);
        console.error('WebSocket error:', event);
        const err = new Error('Failed to connect to signaling server');
        this.onError?.(err);
        reject(err);
      });

      addWsListener('close', (event) => {
        clearTimeout(connectTimeout);
        if (
          !event.wasClean &&
          this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS
        ) {
          console.log(
            `Connection lost, attempting to reconnect (${this.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`,
          );
          this.reconnectAttempts++;
          setTimeout(() => {
            void this.connect().catch((error: unknown) =>
              this.onError?.(error),
            );
          }, RECONNECT_DELAY_MS);
        }
      });

      addWsListener('message', (event) => {
        try {
          const data: unknown = event.data;
          if (typeof data === 'string') {
            void this.handleSignalingMessage(JSON.parse(data));
          } else {
            console.warn('Unexpected non-text signaling message');
          }
        } catch (error: unknown) {
          console.error('Error handling signaling message:', error);
          const err =
            error instanceof Error
              ? error
              : new Error('Unknown signaling error');
          this.onError?.(err);
        }
      });
    });
  }

  private setupPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: STUN_SERVERS,
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'ice-candidate',
            payload: event.candidate,
          }),
        );
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        console.log('Connection state:', this.pc.connectionState);
        this.onConnectionStateChange?.(this.pc.connectionState);
      }
    };

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    const dc = this.dataChannel;
    const addDcListener = <K extends keyof RTCDataChannelEventMap>(
      type: K,
      handler: (this: RTCDataChannel, event: RTCDataChannelEventMap[K]) => void,
    ) => {
      if (typeof dc.addEventListener === 'function') {
        dc.addEventListener(type, handler);
      } else {
        const prop =
          type === 'message'
            ? 'onmessage'
            : type === 'close'
              ? 'onclose'
              : 'onopen';
        (dc as unknown as Record<string, unknown>)[prop] = handler;
      }
    };

    addDcListener('open', () => {
      console.log('Data channel opened');
    });

    addDcListener('close', () => {
      console.log('Data channel closed');
    });

    addDcListener('message', (event) => {
      if (typeof event.data === 'string' || event.data instanceof ArrayBuffer) {
        this.handleDataChannelMessage(event.data);
      } else {
        throw new TypeError('Unexpected event data');
      }
    });
  }

  async handleSignalingMessage(message: unknown) {
    if (!this.pc) return;

    if (!message || typeof (message as { type?: unknown }).type !== 'string') {
      return;
    }
    const msg = message as {
      type:
        | 'connected'
        | 'offer'
        | 'answer'
        | 'ice-candidate'
        | 'peer-disconnected';
      payload?: unknown;
      role?: string;
    };

    switch (msg.type) {
      case 'connected': {
        console.log('Connected as:', msg.role);
        break;
      }

      case 'offer': {
        await this.pc.setRemoteDescription(
          msg.payload as RTCSessionDescriptionInit,
        );
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.ws?.send(
          JSON.stringify({
            type: 'answer',
            payload: answer,
          }),
        );
        break;
      }

      case 'answer': {
        await this.pc.setRemoteDescription(
          msg.payload as RTCSessionDescriptionInit,
        );
        break;
      }

      case 'ice-candidate': {
        await this.pc.addIceCandidate(msg.payload as RTCIceCandidateInit);
        break;
      }

      case 'peer-disconnected': {
        console.log('Peer disconnected');
        this.close();
        break;
      }
    }
  }

  async createOffer(): Promise<void> {
    if (!this.pc) throw new Error('Peer connection not initialized');

    // Create data channel (only the offerer creates it)
    this.dataChannel = this.pc.createDataChannel('fileTransfer');
    this.setupDataChannel();

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.ws?.send(
      JSON.stringify({
        type: 'offer',
        payload: offer,
      }),
    );
  }

  async sendFile(file: File): Promise<void> {
    if (this.dataChannel?.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    // Send file metadata first
    const metadata = {
      type: 'file-metadata',
      name: file.name,
      size: file.size,
      mimeType: file.type,
    };
    this.dataChannel.send(JSON.stringify(metadata));

    // Send file in chunks
    const chunkSize = 16_384; // 16KB chunks
    let offset = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const arrayBuffer = await chunk.arrayBuffer();
      this.dataChannel.send(arrayBuffer);
      offset += chunkSize;
    }

    // Send end marker
    this.dataChannel.send(JSON.stringify({ type: 'file-end' }));
  }

  private fileBuffer: ArrayBuffer[] = [];
  private currentFileMetadata: {
    name: string;
    size: number;
    mimeType: string;
  } | null = null;

  private handleDataChannelMessage(data: string | ArrayBuffer): void {
    if (typeof data === 'string') {
      const parsed = JSON.parse(data) as
        | {
            type: 'file-metadata';
            name: string;
            size: number;
            mimeType: string;
          }
        | { type: string };

      if (typeof parsed === 'object' && 'type' in parsed) {
        if (
          parsed.type === 'file-metadata' &&
          'name' in parsed &&
          'size' in parsed &&
          'mimeType' in parsed
        ) {
          this.currentFileMetadata = {
            name: `{parsed.name}`,
            size: Number.parseInt(`{parsed.size}`, 10),
            mimeType: `{parsed.mimeType}`,
          };
          this.fileBuffer = [];
        } else if (
          'type' in parsed &&
          parsed.type === 'file-end' &&
          this.currentFileMetadata
        ) {
          // Reconstruct file from chunks
          const blob = new Blob(this.fileBuffer, {
            type: this.currentFileMetadata.mimeType,
          });
          const file = new File([blob], this.currentFileMetadata.name, {
            type: this.currentFileMetadata.mimeType,
          });

          this.onFileReceived?.(file);
          this.fileBuffer = [];
          this.currentFileMetadata = null;
        } else {
          throw new Error(`Invalid message type: ${parsed.type}`);
        }
      } else {
        throw new Error('Invalid message format');
      }
    } else {
      // Binary data - file chunk
      this.fileBuffer.push(data);
    }
  }

  setOnFileReceived(callback: (file: File) => void) {
    this.onFileReceived = callback;
  }

  setOnConnectionStateChange(
    callback: (state: RTCPeerConnectionState) => void,
  ) {
    this.onConnectionStateChange = callback;
  }

  setOnError(callback: (error: unknown) => void) {
    this.onError = callback;
  }

  close() {
    this.dataChannel?.close();
    this.pc?.close();
    this.ws?.close();
    this.pc = null;
    this.ws = null;
    this.dataChannel = null;
  }
}
