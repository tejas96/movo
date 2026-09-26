import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import type { TypeVariant } from '../tokens/typography';
import { cn } from './cn';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'disabled'
  | 'inverse'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Centre the text. */
  center?: boolean;
  className?: string;
}

const VARIANT: Record<TypeVariant, string> = {
  display: 'text-display font-semibold',
  h1: 'text-h1 font-semibold',
  h2: 'text-h2 font-semibold',
  h3: 'text-h3 font-semibold',
  title: 'text-title font-semibold',
  body: 'text-body font-normal',
  bodyMedium: 'text-body-medium font-medium',
  caption: 'text-caption font-normal',
  label: 'text-label font-normal',
  micro: 'text-micro font-medium',
};

const TONE: Record<TextTone, string> = {
  primary: 'text-ink',
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
