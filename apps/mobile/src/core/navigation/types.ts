import { type NavigatorScreenParams, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { featureRoutes } from './registry';
import type { ParamsOf } from './routes';

export type TabParamList = {
  Home: undefined;
  Society: undefined;
  Money: undefined;
  Market: undefined;
  Me: undefined;
};

/** The app shell: the tab bar. */
export type ShellParams = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
};

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never;

/** Flattens an intersection into one object type so editor hovers stay readable. */
type Merge<T> = { [K in keyof T]: T[K] };

/** Built from every feature's own params (`features/<x>/routes.tsx`) in the registry. */
export type RootStackParamList = Merge<
  UnionToIntersection<ParamsOf<(typeof featureRoutes)[number]>>
>;

export type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function useNav(): RootNav {
  return useNavigation<RootNav>();
}
