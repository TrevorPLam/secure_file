// AI-META-BEGIN
// AI-META: React Query client configuration - global query/mutation settings with custom fetch wrapper
// OWNERSHIP: client/lib
// ENTRYPOINTS: Wrapped around App.tsx via QueryClientProvider
// DEPENDENCIES: @tanstack/react-query (QueryClient)
// DANGER: Default on401 behavior is "throw" - can customize per query; credentials: "include" for cookie auth; no retry, no refetch, staleTime=Infinity for manual cache control
// CHANGE-SAFETY: Safe to adjust default options, unsafe to change on401 behavior or queryFn signature without auditing all queries
// TESTS: Manual testing with authenticated/unauthenticated requests
// AI-META-END

import { QueryClient, QueryFunction } from '@tanstack/react-query'

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText
    throw new Error(`${res.status}: ${text}`)
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  })

  await throwIfResNotOk(res)
  return res
}

type UnauthorizedBehavior = 'returnNull' | 'throw'
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join('/') as string, {
      credentials: 'include',
    })

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null
    }

    await throwIfResNotOk(res)
    return await res.json()
  }

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
})
