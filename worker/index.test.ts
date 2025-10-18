import { describe, it, expect, vi } from 'vitest'
import worker from './index'

describe('Worker Request Routing', () => {
  it('should route API requests to signaling handler', async () => {
    const request = new Request('https://example.com/api/signal')
    const env = {
      SIGNALING_SERVER: {} as DurableObjectNamespace,
      ASSETS: {} as Fetcher
    }

    const response = await worker.fetch(request, env)
    
    expect(response.status).toBe(501)
    expect(await response.text()).toBe('Signaling API - not yet implemented')
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

  it('should handle different API paths under /api/signal', async () => {
    const paths = [
      '/api/signal',
      '/api/signal/connect',
      '/api/signal/offer',
      '/api/signal/answer'
    ]

    for (const path of paths) {
      const request = new Request(`https://example.com${path}`)
      const env = {
        SIGNALING_SERVER: {} as DurableObjectNamespace,
        ASSETS: {} as Fetcher
      }

      const response = await worker.fetch(request, env)
      expect(response.status).toBe(501)
    }
  })
})
