import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, error) =>
        count < 2 && !(isApiError(error) && error.status > 0 && error.status < 500),
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
