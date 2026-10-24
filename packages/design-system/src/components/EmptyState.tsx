import type { ImageSourcePropType } from 'react-native';
import { View } from 'react-native';
import type { BoldIconName } from '../icons';
import { Button } from './Button';
import { cn } from './cn';
import { ArtFill } from './glow/ArtFill';
import { Glass } from './glow/Glass';
import { Icon } from './Icon';
import { Text } from './Text';
import { theme } from './theme';

export interface EmptyStateProps {
  icon: BoldIconName;
  /** Old photo option. Soft Glow draws a colour-art disc instead, so it is ignored. */
  photo?: ImageSourcePropType;
  title: string;
  body?: string | undefined;
  actionLabel?: string;
  onAction?: () => void;
  /** Spinner on the button while the action runs (a retry, for example). */
  actionLoading?: boolean;
  className?: string;
}

/** A glass card: the icon on a moving colour-art disc, title, one line of help, a button. */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  actionLoading,
  className,
}: EmptyStateProps) {
  return (
    <Glass radius={30} className={cn('items-center px-5 py-7', className)}>
      <ArtFill art="tilePink" radius={32} fade={0} blur={14} style={{ width: 64, height: 64 }}>
        <View className="flex-1 items-center justify-center">
          <Icon name={icon} variant="linear" size={26} color={theme.color.icon.primary} />
        </View>
      </ArtFill>
      <Text variant="title" center className="mt-3.5">
        {title}
      </Text>
      {body ? (
        <Text variant="label" tone="secondary" center className="mt-1">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          variant="white"
          size="sm"
          inline
          loading={actionLoading}
          onPress={onAction}
          className="mt-3"
        />
      ) : null}
    </Glass>
  );
}
