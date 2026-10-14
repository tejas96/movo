import { MutationCache, QueryClient } from '@tanstack/react-query';
import { isHomeKey } from '../../features/home/keys';
import { isApiError } from './errors';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** false: this change cannot move anything on Home (password, account), so skip the refresh. */
      refreshHome?: boolean;
    };
  }
}

export const queryClient = new QueryClient({
  // Home sums up the whole society (attention, dues, upcoming, notices), so any change made in
  // the app refreshes it. Only the Home on screen refetches; others are marked stale.
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _result, mutation) => {
      if (mutation.meta?.refreshHome === false) return;
      void queryClient.invalidateQueries({ predicate: (q) => isHomeKey(q.queryKey) });
    },
  }),
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
