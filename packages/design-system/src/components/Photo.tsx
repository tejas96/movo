import type { ReactNode } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import type { IconName } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { IconSquare } from './IconButtons';
import { Pill } from './Pill';
import { Press } from './Press';
import { Text } from './Text';
import { theme } from './theme';

export interface PhotoPill {
  icon?: IconName;
  label: string;
}

export interface PhotoHeaderProps {
  source: ImageSourcePropType;
  onBack?: () => void;
  /** Top right action, usually an IconSquare with tone="white". */
  trailing?: ReactNode;
  /** Up to three stat pills floating at the bottom of the photo. */
  pills?: readonly PhotoPill[];
  height?: number;
  className?: string;
}

/**
 * Big rounded photo at the top of a module screen, like the reference detail screen:
 * white back square top left, an action top right, stat pills along the bottom.
 */
export function PhotoHeader({
  source,
  onBack,
  trailing,
  pills,
  height = 236,
  className,
}: PhotoHeaderProps) {
  return (
    <View className={cn('overflow-hidden rounded-xl bg-card', className)} style={{ height }}>
      <Image
        source={source}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
      />
      <View className="flex-row items-start justify-between p-3">
        {onBack ? (
          <IconSquare icon="back" variant="linear" tone="white" onPress={onBack} />
        ) : (
          <View />
        )}
        {trailing}
      </View>
      {pills && pills.length > 0 ? (
        <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-2 px-3">
          {pills.map((p) => (
            <Pill key={p.label} icon={p.icon} label={p.label} tone="overlay" size="sm" />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export interface PhotoCardProps {
  source: ImageSourcePropType;
  /** Pill on the photo, top left. */
  badge?: PhotoPill;
  /** Any node top left instead of the badge pill (a pill with a custom mark). */
  leading?: ReactNode;
  /** Top right over the photo, usually a CircleButton. */
  action?: ReactNode;
  photoHeight?: number;
  onPress?: () => void;
  children?: ReactNode;
  className?: string;
}

/** The reference listing card: gray card, inset photo with a pill, content under it. */
export function PhotoCard({
  source,
  badge,
  leading,
  action,
  photoHeight = 170,
  onPress,
  children,
  className,
}: PhotoCardProps) {
  const body = (
    <>
      <View className="overflow-hidden rounded-lg" style={{ height: photoHeight }}>
        <Image
          source={source}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        />
        <View className="flex-row items-start justify-between p-3">
          {leading ??
            (badge ? (
              <Pill icon={badge.icon} label={badge.label} tone="overlay" size="sm" />
            ) : (
              <View />
            ))}
          {action}
        </View>
      </View>
      {children ? <View className="px-3 pb-3 pt-4">{children}</View> : null}
    </>
  );
  const cls = cn('rounded-xl bg-card p-2', className);
  if (!onPress) return <View className={cls}>{body}</View>;
  return (
    <Press
      accessibilityRole="button"
      onPress={onPress}
      className={cn(cls, 'active:opacity-pressed')}
    >
      {body}
    </Press>
  );
}

export interface PhotoTileProps {
  source: ImageSourcePropType;
  label: string;
  icon?: IconName;
  hint?: string | undefined;
  count?: number | undefined;
  height?: number;
  onPress?: () => void;
  className?: string;
}

/** Photo tile for grids: the photo fills the tile, the label sits in a white pill at the bottom. */
export function PhotoTile({
  source,
  label,
  icon,
  hint,
  count,
  height = 128,
  onPress,
  className,
}: PhotoTileProps) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={cn('flex-1 overflow-hidden rounded-lg bg-card active:opacity-pressed', className)}
      style={{ height }}
    >
      <Image
        source={source}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
      />
      {count ? (
        <View className="absolute right-2.5 top-2.5 h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5">
          <Text variant="micro" tone="inverse">
            {count > 99 ? '99+' : String(count)}
          </Text>
        </View>
      ) : null}
      <View className="absolute bottom-2 left-2 right-2">
        <View className="self-start rounded-md bg-overlay px-3 py-1.5" style={{ maxWidth: '100%' }}>
          <View className="flex-row items-center gap-1.5">
            {icon ? <IconGlyph name={icon} /> : null}
            <Text variant="caption" className="font-medium shrink" numberOfLines={1}>
              {label}
            </Text>
          </View>
          {hint ? (
            <Text variant="micro" tone="secondary" className="font-normal" numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
      </View>
    </Press>
  );
}

function IconGlyph({ name }: { name: IconName }) {
  return <Icon name={name} variant="bold" size={16} color={theme.color.icon.primary} />;
}

export interface ModuleHeaderProps extends Omit<PhotoHeaderProps, 'className'> {
  title: string;
  subtitle?: string | undefined;
  className?: string;
}

/** Top of a module screen: the module photo with back and action on it, a big title under it. */
export function ModuleHeader({ title, subtitle, className, ...photo }: ModuleHeaderProps) {
  return (
    <View className={className}>
      <PhotoHeader height={200} {...photo} />
      <Text variant="h1" className="mt-4">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" tone="secondary" className="mt-0.5">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
