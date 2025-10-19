import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebRTCConnection } from './webrtc'

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  static OPEN = 1
  readyState = 1
  url: string
  onopen: (() => void) | null = null
  onerror: ((error: any) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  send = vi.fn()
  close = vi.fn()
  
  constructor(url: string) {
    this.url = url
    setTimeout(() => this.onopen?.(), 0)
  }
} as any

// Mock RTCPeerConnection
global.RTCPeerConnection = class MockRTCPeerConnection {
  localDescription: RTCSessionDescription | null = null
  remoteDescription: RTCSessionDescription | null = null
  connectionState: RTCPeerConnectionState = 'new'
  config: RTCConfiguration
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null
  
  constructor(config: RTCConfiguration) {
    this.config = config
  }
  
  createDataChannel = vi.fn((label: string) => ({
    label,
    readyState: 'open',
    send: vi.fn(),
    close: vi.fn(),
    onopen: null,
    onclose: null,
    onmessage: null
  }))
  
  createOffer = vi.fn(async () => ({
    type: 'offer' as RTCSdpType,
    sdp: 'mock-offer-sdp'
  }))
  
  createAnswer = vi.fn(async () => ({
    type: 'answer' as RTCSdpType,
    sdp: 'mock-answer-sdp'
  }))
  
  setLocalDescription = vi.fn(async () => {})
  setRemoteDescription = vi.fn(async () => {})
  addIceCandidate = vi.fn(async () => {})
  close = vi.fn()
} as any

describe('WebRTCConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Connection Setup', () => {
    it('should connect to signaling server with session ID', async () => {
      const sessionId = 'test-session-123'
      const connection = new WebRTCConnection(sessionId)
      
      await connection.connect()
      
      // Check WebSocket was created with correct URL
      expect(connection['ws']).toBeDefined()
    })

    it('should create RTCPeerConnection with STUN servers', async () => {
      const connection = new WebRTCConnection('test-session')
      await connection.connect()
      
      expect(connection['pc']).toBeDefined()
      const pc = connection['pc'] as any
      expect(pc.config).toHaveProperty('iceServers')
    })
  })

  describe('Signaling', () => {
    it('should create and send offer', async () => {
      const connection = new WebRTCConnection('test-session')
      await connection.connect()
      
      const wsSend = connection['ws']?.send as ReturnType<typeof vi.fn>
      wsSend.mockClear()
      
      await connection.createOffer()
      
      expect(connection['pc']?.createOffer).toHaveBeenCalled()
      expect(connection['pc']?.setLocalDescription).toHaveBeenCalled()
      expect(wsSend).toHaveBeenCalledWith(
        expect.stringContaining('"type":"offer"')
      )
    })

    it('should handle incoming offer and send answer', async () => {
      const connection = new WebRTCConnection('test-session')
      await connection.connect()
      
      const wsSend = connection['ws']?.send as ReturnType<typeof vi.fn>
      wsSend.mockClear()
      
      await connection['handleSignalingMessage']({
        type: 'offer',
        payload: { type: 'offer', sdp: 'mock-sdp' }
      })
      
      expect(connection['pc']?.setRemoteDescription).toHaveBeenCalled()
      expect(connection['pc']?.createAnswer).toHaveBeenCalled()
      expect(wsSend).toHaveBeenCalledWith(
        expect.stringContaining('"type":"answer"')
      )
    })

    it('should handle ICE candidates', async () => {
      const connection = new WebRTCConnection('test-session')
      await connection.connect()
      
      const candidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0'
      }
      
      await connection['handleSignalingMessage']({
        type: 'ice-candidate',
        payload: candidate
      })
      
      expect(connection['pc']?.addIceCandidate).toHaveBeenCalledWith(candidate)
    })
  })

  describe('Data Channel', () => {
    it('should create data channel when creating offer', async () => {
      const connection = new WebRTCConnection('test-session')
      await connection.connect()
      
      await connection.createOffer()
      
      expect(connection['pc']?.createDataChannel).toHaveBeenCalledWith('fileTransfer')
      expect(connection['dataChannel']).toBeDefined()
    })

    it('should send file metadata before chunks', async () => {
      const connection = new WebRTCConnection('test-session')
      await connection.connect()
      await connection.createOffer()
      
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const channelSend = connection['dataChannel']?.send as ReturnType<typeof vi.fn>
      
      await connection.sendFile(mockFile)
      
      // First call should be metadata
      expect(channelSend).toHaveBeenCalled()
      const firstCall = channelSend.mock.calls[0][0]
      expect(firstCall).toContain('"type":"file-metadata"')
      expect(firstCall).toContain('"name":"test.txt"')
    })
  })

  describe('Connection Lifecycle', () => {
    it('should handle peer disconnection', async () => {
      const connection = new WebRTCConnection('test-session')
      await connection.connect()
      
      const closeSpy = vi.spyOn(connection, 'close')
      
      await connection['handleSignalingMessage']({
        type: 'peer-disconnected'
      })
      
      expect(closeSpy).toHaveBeenCalled()
    })

    it('should cleanup resources on close', async () => {
      const connection = new WebRTCConnection('test-session')
      await connection.connect()
      
      const pc = connection['pc']
      const ws = connection['ws']
      
      connection.close()
      
      expect(pc?.close).toHaveBeenCalled()
      expect(ws?.close).toHaveBeenCalled()
      expect(connection['pc']).toBeNull()
      expect(connection['ws']).toBeNull()
    })
  })
})
