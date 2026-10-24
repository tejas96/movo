import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { BoldIconName } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { IconSquare } from './IconButtons';
import { Text } from './Text';
import { theme } from './theme';

export interface HomeTopBarProps {
  icon: BoldIconName;
  label: string;
  value: string;
  onPressValue?: () => void;
  trailing?: ReactNode;
  className?: string;
}

/** Home header: icon square, small gray label, bold value with a chevron, actions on the right. */
export function HomeTopBar({
  icon,
  label,
  value,
  onPressValue,
  trailing,
  className,
}: HomeTopBarProps) {
  return (
    <View className={cn('flex-row items-center gap-3 min-h-[52px]', className)}>
      <IconSquare icon={icon} />
      <Pressable
        onPress={onPressValue}
        disabled={!onPressValue}
        className="flex-1 min-w-0"
        accessibilityRole="button"
      >
        <Text variant="label" tone="secondary">
          {label}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Text variant="title" numberOfLines={1} className="shrink">
            {value}
          </Text>
          {onPressValue ? (
            <Icon name="chevronDown" size={16} color={theme.color.text.secondary} />
          ) : null}
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

export interface TitleBarProps {
  title: string;
  onBack?: () => void;
  /** Right action square. */
  trailing?: ReactNode;
  /** Left aligned big title instead of a centred header. */
  large?: boolean;
  subtitle?: string | undefined;
  className?: string;
}

/** Soft Glow header: round back button, big left title, an action on the right. */
export function TitleBar({ title, onBack, trailing, large, subtitle, className }: TitleBarProps) {
  if (large) {
    return (
      <View className={cn('flex-row items-center gap-3 min-h-[52px]', className)}>
        <View className="flex-1 min-w-0">
          <Text variant="h1" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="label" tone="secondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing}
      </View>
    );
  }
  return (
    <View className={cn('flex-row items-center gap-3 min-h-[52px]', className)}>
      {onBack ? (
        <IconSquare
          icon="back"
          variant="linear"
          diameter={46}
          onPress={onBack}
          accessibilityLabel="Back"
        />
      ) : null}
      <View className="flex-1 min-w-0">
        <Text variant="h1" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
