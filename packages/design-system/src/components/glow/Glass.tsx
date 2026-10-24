import type { ReactNode } from 'react';
import {
  type PressableProps,
  type StyleProp,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ArtName, ArtPreset } from '../../tokens/glow';
import { Press } from '../Press';
import { theme } from '../theme';
import { ArtFill } from './ArtFill';
import { InGlass } from './in-glass';

const glassStyle = (radius: number): ViewStyle => ({
  borderRadius: radius,
  backgroundColor: theme.color.bg.card,
  borderWidth: 1.5,
  borderColor: theme.color.border.glass,
  ...theme.shadow.glass,
});

export interface GlassProps extends ViewProps {
  /** Corner radius. Default 30 (cards); lists use 28, the greeting 32, pills 9999. */
  radius?: number;
  /** Makes the whole card a button. */
  onPress?: PressableProps['onPress'];
  accessibilityLabel?: string;
  className?: string;
}

/**
 * Frosted glass card: white at 50% over the mist, a bright white rim, a white top highlight
 * and a wide soft shadow. The glow behind is already blurred, so no live backdrop blur is needed.
 */
export function Glass({
  radius = theme.radius['2xl'],
  onPress,
  style,
  className,
  children,
  accessibilityLabel,
  ...rest
}: GlassProps) {
  if (onPress)
    return (
      <Press
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        scaleTo={0.97}
        className={className}
        style={[glassStyle(radius), style as StyleProp<ViewStyle>]}
      >
        {children}
      </Press>
    );
  return (
    <View
      {...rest}
      accessibilityLabel={accessibilityLabel}
      className={className}
      style={[glassStyle(radius), style]}
    >
      <InGlass.Provider value={true}>{children}</InGlass.Provider>
    </View>
  );
}

export interface ArtCardProps {
  art: ArtName | ArtPreset;
  /** Height of the art (inside the rim). */
  height?: number;
  /** Outer corner radius. Default 34; the art inside is 5 less. */
  radius?: number;
  /** White fade at the bottom of the art, 0..1. Default 0.8. */
  fade?: number;
  fadeFrom?: number;
  blur?: number;
  onPress?: PressableProps['onPress'];
  accessibilityLabel?: string;
  /** Padding and layout of the content on the art. */
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** A moving art card inside a thick white rim, as in the mockup's Notices, Money and Members. */
export function ArtCard({
  art,
  height,
  radius = theme.radius.rim,
  fade,
  fadeFrom,
  blur,
  onPress,
  accessibilityLabel,
  contentStyle,
  style,
  children,
}: ArtCardProps) {
  const rim = theme.layout.rim;
  const outer: ViewStyle = {
    padding: rim,
    borderRadius: radius,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    ...theme.shadow.rim,
  };
  const inner = (
    <ArtFill
      art={art}
      radius={radius - rim}
      fade={fade}
      fadeFrom={fadeFrom}
      blur={blur}
      style={[height ? { height } : null, { padding: 18 }, contentStyle]}
    >
      {children}
    </ArtFill>
  );
  if (onPress)
    return (
      <Press
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        scaleTo={0.97}
        style={[outer, style]}
      >
        {inner}
      </Press>
    );
  return <View style={[outer, style]}>{inner}</View>;
}

export interface ArrowCircleProps {
  size?: number;
  /** `play` = a filled triangle (next event); `arrow` = the up-right arrow. */
  glyph?: 'arrow' | 'play';
  style?: StyleProp<ViewStyle>;
}

/** White circle with the orange up-right arrow: the end of every Soft Glow button and card. */
export function ArrowCircle({ size = 40, glyph = 'arrow', style }: ArrowCircleProps) {
  const g = Math.round(size * 0.4);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.color.bg.nested,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadow.lifted,
        },
        style,
      ]}
    >
      <Svg width={g} height={g} viewBox="0 0 24 24">
        {glyph === 'play' ? (
          <Path
            d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"
            fill={theme.color.accent.fg}
          />
        ) : (
          <Path
            d="M7 17L17 7M9 7h8v8"
            fill="none"
            stroke={theme.color.accent.fg}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </View>
  );
}
