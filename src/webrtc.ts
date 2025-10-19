// WebRTC configuration
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 2000

export class WebRTCConnection {
  private pc: RTCPeerConnection | null = null
  private ws: WebSocket | null = null
  private dataChannel: RTCDataChannel | null = null
  private sessionId: string
  private reconnectAttempts = 0
  private onFileReceived?: (file: File) => void
  private onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  private onError?: (error: Error) => void

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  async connect(): Promise<void> {
    // Connect to signaling server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/signal/connect?session=${this.sessionId}`

    this.ws = new WebSocket(wsUrl)

    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('WebSocket not initialized'))

      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timeout - please check your internet connection'))
      }, 10000)

      this.ws.onopen = () => {
        clearTimeout(connectTimeout)
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.setupPeerConnection()
        resolve()
      }

      this.ws.onerror = (error) => {
        clearTimeout(connectTimeout)
        console.error('WebSocket error:', error)
        const err = new Error('Failed to connect to signaling server')
        this.onError?.(err)
        reject(err)
      }

      this.ws.onclose = (event) => {
        clearTimeout(connectTimeout)
        if (!event.wasClean && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          console.log(`Connection lost, attempting to reconnect (${this.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`)
          this.reconnectAttempts++
          setTimeout(() => {
            this.connect().catch(err => this.onError?.(err))
          }, RECONNECT_DELAY_MS)
        }
      }

      this.ws.onmessage = async (event) => {
        try {
          await this.handleSignalingMessage(JSON.parse(event.data))
        } catch (error) {
          console.error('Error handling signaling message:', error)
          this.onError?.(error as Error)
        }
      }
    })
  }

  private setupPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: STUN_SERVERS
    })

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ice-candidate',
          payload: event.candidate
        }))
      }
    }

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        console.log('Connection state:', this.pc.connectionState)
        this.onConnectionStateChange?.(this.pc.connectionState)
      }
    }

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel
      this.setupDataChannel()
    }
  }

  private setupDataChannel() {
    if (!this.dataChannel) return

    this.dataChannel.onopen = () => {
      console.log('Data channel opened')
    }

    this.dataChannel.onclose = () => {
      console.log('Data channel closed')
    }

    this.dataChannel.onmessage = async (event) => {
      await this.handleDataChannelMessage(event.data)
    }
  }

  private async handleSignalingMessage(message: any) {
    if (!this.pc) return

    switch (message.type) {
      case 'connected':
        console.log('Connected as:', message.role)
        break

      case 'offer':
        await this.pc.setRemoteDescription(message.payload)
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)
        this.ws?.send(JSON.stringify({
          type: 'answer',
          payload: answer
        }))
        break

      case 'answer':
        await this.pc.setRemoteDescription(message.payload)
        break

      case 'ice-candidate':
        await this.pc.addIceCandidate(message.payload)
        break

      case 'peer-disconnected':
        console.log('Peer disconnected')
        this.close()
        break
    }
  }

  async createOffer(): Promise<void> {
    if (!this.pc) throw new Error('Peer connection not initialized')

    // Create data channel (only the offerer creates it)
    this.dataChannel = this.pc.createDataChannel('fileTransfer')
    this.setupDataChannel()

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)

    this.ws?.send(JSON.stringify({
      type: 'offer',
      payload: offer
    }))
  }

  async sendFile(file: File): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready')
    }

    // Send file metadata first
    const metadata = {
      type: 'file-metadata',
      name: file.name,
      size: file.size,
      mimeType: file.type
    }
    this.dataChannel.send(JSON.stringify(metadata))

    // Send file in chunks
    const chunkSize = 16384 // 16KB chunks
    let offset = 0

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize)
      const arrayBuffer = await chunk.arrayBuffer()
      this.dataChannel.send(arrayBuffer)
      offset += chunkSize
    }

    // Send end marker
    this.dataChannel.send(JSON.stringify({ type: 'file-end' }))
  }

  private fileBuffer: ArrayBuffer[] = []
  private currentFileMetadata: { name: string; size: number; mimeType: string } | null = null

  private async handleDataChannelMessage(data: string | ArrayBuffer) {
    if (typeof data === 'string') {
      const message = JSON.parse(data)

      if (message.type === 'file-metadata') {
        this.currentFileMetadata = {
          name: message.name,
          size: message.size,
          mimeType: message.mimeType
        }
        this.fileBuffer = []
      } else if (message.type === 'file-end' && this.currentFileMetadata) {
        // Reconstruct file from chunks
        const blob = new Blob(this.fileBuffer, { type: this.currentFileMetadata.mimeType })
        const file = new File([blob], this.currentFileMetadata.name, {
          type: this.currentFileMetadata.mimeType
        })

        this.onFileReceived?.(file)
        this.fileBuffer = []
        this.currentFileMetadata = null
      }
    } else {
      // Binary data - file chunk
      this.fileBuffer.push(data)
    }
  }

  setOnFileReceived(callback: (file: File) => void) {
    this.onFileReceived = callback
  }

  setOnConnectionStateChange(callback: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateChange = callback
  }

  setOnError(callback: (error: Error) => void) {
    this.onError = callback
  }

  close() {
    this.dataChannel?.close()
    this.pc?.close()
    this.ws?.close()
    this.pc = null
    this.ws = null
    this.dataChannel = null
  }
}
