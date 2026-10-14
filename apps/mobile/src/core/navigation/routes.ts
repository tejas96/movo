import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { ComponentType } from 'react';

/**
 * Which stack a screen lives in: signed out (auth), signed in without a society (join), or the
 * app. A screen can sit in more than one.
 */
export type ScreenGroup = 'auth' | 'join' | 'app';

/** Launch facts a screen entry can use to stay out of the stack. */
export interface ScreenFlags {
  showWelcome: boolean;
}

export interface ScreenEntry<Name extends string = string> {
  name: Name;
  // biome-ignore lint/suspicious/noExplicitAny: screens type their own route props; the stack checks names, not props.
  component: ComponentType<any>;
  group: ScreenGroup | readonly ScreenGroup[];
  options?: NativeStackNavigationOptions;
  /** Registered only when this returns true. */
  when?: (flags: ScreenFlags) => boolean;
}

type ParamKeys<T> = T extends object ? Extract<keyof T, string> : never;

/**
 * A notification whose `data.screen` equals `kind` opens `route`. With `param`, the data field of
 * that name is required and passed on as the route param of the same name.
 */
export type NotificationEntry<P = Record<string, object | undefined>> = {
  [N in Extract<keyof P, string>]: { kind: string; route: N; param?: ParamKeys<P[N]> };
}[Extract<keyof P, string>];

/** What a feature's `routes.tsx` exports. `P` is the feature's own param list. */
export interface FeatureRoutes<P> {
  screens: readonly ScreenEntry<Extract<keyof P, string>>[];
  notifications?: readonly NotificationEntry<P>[];
  /** Type only: carries `P` so `RootStackParamList` can be built from the registry. */
  readonly params?: P;
}

/** Any feature's routes, once the param types no longer matter. */
export interface AnyFeatureRoutes {
  screens: readonly ScreenEntry[];
  notifications?: readonly AnyNotificationEntry[];
}

/** The param list a `defineRoutes` result carries. */
export type ParamsOf<F> = F extends { readonly params?: infer P } ? NonNullable<P> : never;

/** Editors slide up from the bottom. */
export const editorOptions: NativeStackNavigationOptions = { animation: 'slide_from_bottom' };

/** The app-wide notification entry shape, once every feature's entries are merged. */
export interface AnyNotificationEntry {
  kind: string;
  route: string;
  param?: string;
}
