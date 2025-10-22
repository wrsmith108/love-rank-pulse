/**
 * React Query test provider for integration tests
 * Provides QueryClient configuration optimized for testing
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Create a QueryClient configured for testing
 * - No retries
 * - No caching
 * - Immediate garbage collection
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Test Query Provider component
 */
interface TestQueryProviderProps {
  children: React.ReactNode;
  client?: QueryClient;
}

export function TestQueryProvider({ children, client }: TestQueryProviderProps) {
  const queryClient = client || createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Render with React Query provider
 */
export function renderWithQuery(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { client?: QueryClient }
) {
  const { client, ...renderOptions } = options || {};
  const queryClient = client || createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <TestQueryProvider client={queryClient}>
        {children}
      </TestQueryProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

/**
 * Render with all providers (Router + React Query)
 */
export function renderWithAllProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    client?: QueryClient;
    initialRoute?: string;
  }
) {
  const { client, initialRoute = '/', ...renderOptions } = options || {};
  const queryClient = client || createTestQueryClient();

  // Set initial route if provided
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  function AllProviders({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <TestQueryProvider client={queryClient}>
          {children}
        </TestQueryProvider>
      </BrowserRouter>
    );
  }

  return {
    ...render(ui, { wrapper: AllProviders, ...renderOptions }),
    queryClient,
  };
}

/**
 * Wait for React Query to settle (all queries resolved)
 */
export async function waitForQueryToSettle(queryClient: QueryClient): Promise<void> {
  const maxAttempts = 50;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const queries = queryClient.getQueryCache().getAll();
    const allSettled = queries.every(
      query => query.state.status !== 'pending'
    );

    if (allSettled) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 50));
    attempts++;
  }

  throw new Error('Queries did not settle in time');
}

/**
 * Clear all queries and mutations
 */
export function clearQueryCache(queryClient: QueryClient): void {
  queryClient.clear();
}

/**
 * Get query state for debugging
 */
export function getQueryState(queryClient: QueryClient, queryKey: any[]) {
  return queryClient.getQueryState(queryKey);
}

/**
 * Get query data for debugging
 */
export function getQueryData<T = unknown>(queryClient: QueryClient, queryKey: any[]): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

/**
 * Set query data for testing
 */
export function setQueryData<T = unknown>(
  queryClient: QueryClient,
  queryKey: any[],
  data: T
): void {
  queryClient.setQueryData(queryKey, data);
}

/**
 * Invalidate queries for testing refetch behavior
 */
export async function invalidateQueries(
  queryClient: QueryClient,
  queryKey: any[]
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey });
}

/**
 * Prefetch query data for testing
 */
export async function prefetchQuery<T = unknown>(
  queryClient: QueryClient,
  queryKey: any[],
  queryFn: () => Promise<T>
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
  });
}

/**
 * Mock React Query hook for testing
 */
export function mockUseQuery<T = unknown>(data: T, isLoading: boolean = false, error: Error | null = null) {
  return {
    data,
    isLoading,
    isError: error !== null,
    error,
    isSuccess: !isLoading && error === null,
    refetch: jest.fn(),
    isFetching: false,
    isRefetching: false,
    status: isLoading ? 'pending' : error ? 'error' : 'success',
  };
}

/**
 * Mock React Query mutation for testing
 */
export function mockUseMutation<TData = unknown, TVariables = unknown>(
  mutateOptions?: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
  }
) {
  const mutateFn = jest.fn().mockImplementation(async (variables: TVariables) => {
    try {
      const data = {} as TData;
      mutateOptions?.onSuccess?.(data, variables);
      return data;
    } catch (error) {
      mutateOptions?.onError?.(error as Error, variables);
      throw error;
    }
  });

  return {
    mutate: mutateFn,
    mutateAsync: mutateFn,
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    reset: jest.fn(),
    status: 'idle' as const,
  };
}

/**
 * Query test utilities
 */
export const queryTestUtils = {
  createTestQueryClient,
  waitForQueryToSettle,
  clearQueryCache,
  getQueryState,
  getQueryData,
  setQueryData,
  invalidateQueries,
  prefetchQuery,
  mockUseQuery,
  mockUseMutation,
};
