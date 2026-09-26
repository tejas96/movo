import type { AuthTokens, User } from '@movo/contracts';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '../storage/mmkv';

export type SessionStatus = 'booting' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  user: User | null;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  setSignedIn: (user: User, tokens: AuthTokens) => void;
  setTokens: (tokens: Pick<AuthTokens, 'accessToken' | 'accessTokenExpiresAt'>) => void;
  setUser: (user: User) => void;
  setSignedOut: () => void;
  setBooted: (signedIn: boolean) => void;
}

/** Access token and profile persist in MMKV for a warm start. The refresh token is in the Keychain. */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      status: 'booting',
      user: null,
      accessToken: null,
      accessTokenExpiresAt: null,
      setSignedIn: (user, tokens) =>
        set({
          status: 'signedIn',
          user,
          accessToken: tokens.accessToken,
          accessTokenExpiresAt: Date.parse(tokens.accessTokenExpiresAt),
        }),
      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          accessTokenExpiresAt: Date.parse(tokens.accessTokenExpiresAt),
        }),
      setUser: (user) => set({ user }),
      setSignedOut: () =>
        set({ status: 'signedOut', user: null, accessToken: null, accessTokenExpiresAt: null }),
      setBooted: (signedIn) => set({ status: signedIn ? 'signedIn' : 'signedOut' }),
    }),
    {
      name: 'movo.session',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        accessTokenExpiresAt: s.accessTokenExpiresAt,
      }),
    },
  ),
);
