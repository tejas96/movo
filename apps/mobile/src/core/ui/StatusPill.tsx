import { StatusPill as SoftPill, type StatusTone } from '@movo/design-system';
import type { Namespace, Resources } from '@movo/i18n';
import { useTranslation } from 'react-i18next';

/** "ns:group" for every group of labels in the translations, e.g. "money:status". */
type LabelGroup = {
  [N in Namespace]: {
    [G in keyof Resources[N] & string]: Resources[N][G] extends Record<string, string>
      ? `${N}:${G}`
      : never;
  }[keyof Resources[N] & string];
}[Namespace];

/** The values a label group has a label for: "money:status" -> "DUE" | "PAID" | ... */
type LabelValues<L extends LabelGroup> = L extends `${infer N extends Namespace}:${infer G}`
  ? G extends keyof Resources[N]
    ? keyof Resources[N][G] & string
    : never
  : never;

/** Status value -> pill tone. One map per status, kept next to the feature. */
export type StatusTones<S extends string> = Readonly<Record<S, StatusTone>>;

export interface StatusPillProps<L extends LabelGroup, S extends LabelValues<L>> {
  value: S;
  tones: StatusTones<S>;
  /** Where the labels live: the label is `${labels}.${value}`. TypeScript checks every value has one. */
  labels: L;
  dot?: boolean;
  className?: string;
}

/**
 * The soft status pill for an enum value: tone from the feature's map, label from i18n.
 * `<StatusPill value={bill.status} tones={BILL_TONE} labels="money:status" />`
 */
export function StatusPill<L extends LabelGroup, S extends LabelValues<L>>({
  value,
  tones,
  labels,
  dot,
  className,
}: StatusPillProps<L, S>) {
  const { t } = useTranslation();
  // The key is checked by the types above; i18next cannot follow a key built from generics.
  const label = (t as (key: string) => string)(`${labels}.${value}`);
  return <SoftPill label={label} tone={tones[value]} dot={dot} className={className} />;
}
