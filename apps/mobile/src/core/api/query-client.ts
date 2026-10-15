import NetInfo from '@react-native-community/netinfo';
import { focusManager, MutationCache, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { isHomeKey } from '../home/keys';
import { hasInternet } from '../network/online';
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
      // "Window focus" is the app coming back to the front (see focusManager below): data on
      // screen that is older than staleTime refreshes then.
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
});

// React Native has no window focus. Tell react-query when the app comes to the front or goes to
// the back: coming back refreshes stale data on screen, and polls (market, active alerts) pause
// while the app is in the background instead of using data and battery.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
  return () => sub.remove();
});

// React Native has no navigator.onLine either. Tell react-query when the phone loses or gets back
// its internet: while offline, queries and mutations pause instead of failing and retrying; when
// the network returns, paused work resumes and stale data on screen refetches.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(hasInternet(state))),
);
