// Tests for client/src/lib/queryClient.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, getQueryFn } from '@/lib/queryClient'

describe('apiRequest', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should make successful GET request', async () => {
    const mockResponse = { ok: true, text: vi.fn().mockResolvedValue('') }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const response = await apiRequest('GET', '/api/test')

    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
      method: 'GET',
      headers: {},
      body: undefined,
      credentials: 'include',
    })
    expect(response).toEqual(mockResponse)
  })

  it('should make successful POST request with data', async () => {
    const mockData = { name: 'Test', value: 123 }
    const mockResponse = { ok: true, text: vi.fn().mockResolvedValue('') }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const response = await apiRequest('POST', '/api/create', mockData)

    expect(global.fetch).toHaveBeenCalledWith('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockData),
      credentials: 'include',
    })
    expect(response).toEqual(mockResponse)
  })

  it('should make successful PUT request with data', async () => {
    const mockData = { id: 1, name: 'Updated' }
    const mockResponse = { ok: true, text: vi.fn().mockResolvedValue('') }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await apiRequest('PUT', '/api/update', mockData)

    expect(global.fetch).toHaveBeenCalledWith('/api/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockData),
      credentials: 'include',
    })
  })

  it('should make successful DELETE request', async () => {
    const mockResponse = { ok: true, text: vi.fn().mockResolvedValue('') }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await apiRequest('DELETE', '/api/delete/123')

    expect(global.fetch).toHaveBeenCalledWith('/api/delete/123', {
      method: 'DELETE',
      headers: {},
      body: undefined,
      credentials: 'include',
    })
  })

  it('should throw error when response is not ok (404)', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue('Resource not found'),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(apiRequest('GET', '/api/missing')).rejects.toThrow('404: Resource not found')
  })

  it('should throw error when response is not ok (500)', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue(''),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(apiRequest('POST', '/api/fail')).rejects.toThrow('500: Internal Server Error')
  })

  it('should throw error with custom error message', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: vi.fn().mockResolvedValue('Invalid input data'),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(apiRequest('POST', '/api/validate', {})).rejects.toThrow('400: Invalid input data')
  })

  it('should include credentials in request', async () => {
    const mockResponse = { ok: true, text: vi.fn().mockResolvedValue('') }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await apiRequest('GET', '/api/auth')

    const fetchCall = (global.fetch as any).mock.calls[0]
    expect(fetchCall[1].credentials).toBe('include')
  })

  it('should handle empty data parameter', async () => {
    const mockResponse = { ok: true, text: vi.fn().mockResolvedValue('') }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await apiRequest('POST', '/api/test', undefined)

    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      headers: {},
      body: undefined,
      credentials: 'include',
    })
  })
})

describe('getQueryFn', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch data successfully with throw on 401', async () => {
    const mockData = { id: 1, name: 'Test' }
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockData),
      text: vi.fn().mockResolvedValue(''),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const queryFn = getQueryFn({ on401: 'throw' })
    const result = await queryFn({
      queryKey: ['/api', 'test'],
      signal: new AbortController().signal,
      meta: {},
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
      credentials: 'include',
    })
    expect(result).toEqual(mockData)
  })

  it('should throw error on 401 when on401 is throw', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: vi.fn().mockResolvedValue('Unauthorized'),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const queryFn = getQueryFn({ on401: 'throw' })

    await expect(
      queryFn({
        queryKey: ['/api', 'protected'],
        signal: new AbortController().signal,
        meta: {},
      })
    ).rejects.toThrow('401: Unauthorized')
  })

  it('should return null on 401 when on401 is returnNull', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: vi.fn().mockResolvedValue('Unauthorized'),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const queryFn = getQueryFn({ on401: 'returnNull' })
    const result = await queryFn({
      queryKey: ['/api', 'optional'],
      signal: new AbortController().signal,
      meta: {},
    })

    expect(result).toBeNull()
  })

  it('should throw error on non-401 errors even with returnNull', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue('Server error'),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const queryFn = getQueryFn({ on401: 'returnNull' })

    await expect(
      queryFn({
        queryKey: ['/api', 'error'],
        signal: new AbortController().signal,
        meta: {},
      })
    ).rejects.toThrow('500: Server error')
  })

  it('should join queryKey parts with slashes', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const queryFn = getQueryFn({ on401: 'throw' })
    await queryFn({
      queryKey: ['/api', 'users', '123', 'profile'],
      signal: new AbortController().signal,
      meta: {},
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/users/123/profile', {
      credentials: 'include',
    })
  })

  it('should include credentials in all requests', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const queryFn = getQueryFn({ on401: 'throw' })
    await queryFn({
      queryKey: ['/api', 'data'],
      signal: new AbortController().signal,
      meta: {},
    })

    const fetchCall = (global.fetch as any).mock.calls[0]
    expect(fetchCall[1].credentials).toBe('include')
  })

  it('should parse JSON response correctly', async () => {
    const mockData = { items: [1, 2, 3], total: 3 }
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockData),
      text: vi.fn().mockResolvedValue(''),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const queryFn = getQueryFn({ on401: 'throw' })
    const result = await queryFn({
      queryKey: ['/api', 'items'],
      signal: new AbortController().signal,
      meta: {},
    })

    expect(mockResponse.json).toHaveBeenCalledOnce()
    expect(result).toEqual(mockData)
  })
})
