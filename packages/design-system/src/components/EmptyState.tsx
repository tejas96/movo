import { Image, type ImageSourcePropType, View } from 'react-native';
import type { IconName } from '../icons';
import { Button } from './Button';
import { cn } from './cn';
import { IconSquare } from './IconButtons';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: IconName;
  /** A soft photo above the text. Replaces the icon square. */
  photo?: ImageSourcePropType;
  title: string;
  body?: string | undefined;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Photo or icon square, title, one line of help, optional button. */
export function EmptyState({
  icon,
  photo,
  title,
  body,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <View className={cn('items-center px-5 py-7', className)}>
      {photo ? (
        <Image
          source={photo}
          resizeMode="cover"
          style={{ height: 150, width: '100%', borderRadius: 28 }}
        />
      ) : (
        <IconSquare icon={icon} tone="gray" />
      )}
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
          variant={photo ? 'ink' : 'white'}
          size="sm"
          inline
          onPress={onAction}
          className="mt-3"
        />
      ) : null}
    </View>
  );
}
