import type { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * Online unless NetInfo is sure there is no internet: no network at all, or a network (say a
 * society Wi-Fi with a dead line) that cannot reach the internet. `null` means "not checked
 * yet", which counts as online so the app never starts paused.
 */
export function hasInternet(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * True while react-query is paused for lack of internet (fed by NetInfo in query-client.ts), so
 * the banner and the paused queries always agree.
 */
export function useIsOffline(): boolean {
  return !useSyncExternalStore(subscribe, isOnline);
}

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const isOnline = () => onlineManager.isOnline();
