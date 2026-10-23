import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import type { TypeVariant } from '../tokens/typography';
import { cn } from './cn';

export type TextTone =
  | 'primary'
  | 'soft'
  | 'secondary'
  | 'tertiary'
  | 'disabled'
  | 'inverse'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Centre the text. */
  center?: boolean;
  className?: string;
}

const VARIANT: Record<TypeVariant, string> = {
  display: 'text-display font-medium',
  greet: 'text-greet font-normal',
  h1: 'text-h1 font-semibold',
  h2: 'text-h2 font-medium',
  h3: 'text-h3 font-medium',
  title: 'text-title font-medium',
  body: 'text-body font-normal',
  bodyMedium: 'text-body-medium font-medium',
  caption: 'text-caption font-normal',
  label: 'text-label font-normal',
  section: 'text-section font-normal uppercase',
  micro: 'text-micro font-medium',
};

const TONE: Record<TextTone, string> = {
  primary: 'text-ink',
  soft: 'text-ink-soft',
  accent: 'text-accent',
  secondary: 'text-ink-secondary',
  tertiary: 'text-ink-tertiary',
  disabled: 'text-ink-disabled',
  inverse: 'text-on-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

/** The only text component screens use. Poppins on every platform and every language. */
export function Text({
  variant = 'body',
  tone = 'primary',
  center,
  className,
  ...rest
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={1.3}
      {...rest}
      className={cn('font-sans', VARIANT[variant], TONE[tone], center && 'text-center', className)}
    />
  );
}

/**
 * The one bold word inside a light headline: <Text variant="greet">{t('hi')} <Strong>{name}</Strong></Text>.
 * Nested, so it keeps the line's size and colour and only changes the weight.
 */
export function Strong({ className, ...rest }: RNTextProps & { className?: string }) {
  return <RNText {...rest} className={cn('font-sans font-semibold', className)} />;
}
