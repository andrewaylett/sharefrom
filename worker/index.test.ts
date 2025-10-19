import { describe, it, expect, vi } from 'vitest'
import worker from './index'

describe('Worker Request Routing', () => {
  it('should route WebSocket signaling requests to Durable Object', async () => {
    const mockStub = {
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 101 }))
    }
    
    const mockId = { toString: () => 'test-id' }
    
    const request = new Request('https://example.com/api/signal/connect?session=test-session', {
      headers: { 'Upgrade': 'websocket' }
    })
    
    const env = {
      SIGNALING_SERVER: {
        idFromName: vi.fn().mockReturnValue(mockId),
        get: vi.fn().mockReturnValue(mockStub)
      } as unknown as DurableObjectNamespace,
      ASSETS: {} as Fetcher
    }

    const response = await worker.fetch(request, env)
    
    expect(env.SIGNALING_SERVER.idFromName).toHaveBeenCalledWith('test-session')
    expect(env.SIGNALING_SERVER.get).toHaveBeenCalledWith(mockId)
    expect(mockStub.fetch).toHaveBeenCalledWith(request)
    expect(response.status).toBe(101)
  })

  it('should return 400 for signaling request without session ID', async () => {
    const request = new Request('https://example.com/api/signal/connect')
    const env = {
      SIGNALING_SERVER: {} as DurableObjectNamespace,
      ASSETS: {} as Fetcher
    }

    const response = await worker.fetch(request, env)
    
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Missing session ID')
  })

  it('should route non-API requests to assets', async () => {
    const mockResponse = new Response('<!DOCTYPE html>', { status: 200 })
    const request = new Request('https://example.com/')
    const env = {
      SIGNALING_SERVER: {} as DurableObjectNamespace,
      ASSETS: {
        fetch: vi.fn().mockResolvedValue(mockResponse)
      } as unknown as Fetcher
    }

    const response = await worker.fetch(request, env)
    
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request)
    expect(response).toBe(mockResponse)
  })
})
