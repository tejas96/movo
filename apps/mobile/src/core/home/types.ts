import type { AttentionItem, ModuleKey } from '@movo/contracts';
import type { BoldIconName, RowProps } from '@movo/design-system';
import type { Namespace } from '@movo/i18n';
import type { TFunction } from 'i18next';
import type { ImageSourcePropType } from 'react-native';
import type { RootNav } from '../navigation/types';

export type AttentionType = AttentionItem['type'];
export type AttentionOf<T extends AttentionType> = Extract<AttentionItem, { type: T }>;

/** Home passes one `t` that reads any namespace (`'emergency:type.FIRE'`). */
export type HomeT = TFunction<Namespace[]>;

export interface HomeCtx {
  t: HomeT;
  nav: RootNav;
}

/** One "Needs you" row. */
export type AttentionRowSpec = Pick<
  RowProps,
  'icon' | 'title' | 'subtitle' | 'trailing' | 'tone'
> & {
  onPress: () => void;
};

/** The black card at the top of Home. `amountPaise` counts up instead of showing `value`. */
export interface HeroSpec {
  photo: ImageSourcePropType;
  label: string;
  value: string;
  amountPaise?: number;
  caption?: string | undefined;
  cta?: { label: string; go: () => void } | undefined;
  /** Red "active" pill before the label. */
  danger?: boolean;
}

export interface AttentionEntry<T extends AttentionType> {
  /** Tells two items of the same type apart; the type alone when left out. */
  id?: (item: AttentionOf<T>) => string;
  row: (item: AttentionOf<T>, ctx: HomeCtx) => AttentionRowSpec;
  /** Can take the black card. Lower `priority` wins; the chosen item leaves the rows. */
  hero?: { priority: number; card: (item: AttentionOf<T>, ctx: HomeCtx) => HeroSpec };
}

export type AttentionEntries = { [T in AttentionType]?: AttentionEntry<T> };

export interface QuickCtx {
  moduleOn: (key: ModuleKey) => boolean;
  canManage: boolean;
  attention: readonly AttentionItem[];
}

/** One round button in the quick grid under the tiles. */
export interface QuickTile {
  key: string;
  icon: BoldIconName;
  label: (t: HomeT) => string;
  /** Shown only when this returns true. */
  visible?: (q: QuickCtx) => boolean;
  dot?: (q: QuickCtx) => boolean;
  go: (nav: RootNav) => void;
}

/** What a feature's `home.tsx` gives to Home. */
export interface FeatureHome {
  attention?: AttentionEntries;
  quick?: readonly QuickTile[];
}
