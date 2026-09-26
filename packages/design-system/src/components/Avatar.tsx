import { Image, View } from 'react-native';
import { cn } from './cn';
import { Text } from './Text';

export interface AvatarProps {
  name: string;
  uri?: string | null | undefined;
  size?: 32 | 40 | 44 | 56 | 64;
  /** gray when the avatar sits on white. */
  tone?: 'white' | 'gray';
  className?: string;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return (first + second).toUpperCase();
}

const FONT: Record<NonNullable<AvatarProps['size']>, string> = {
  32: 'text-[12px]',
  40: 'text-[13px]',
  44: 'text-[14px]',
  56: 'text-[16px]',
  64: 'text-[18px]',
};

export function Avatar({ name, uri, size = 44, tone = 'white', className }: AvatarProps) {
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={dims} accessibilityLabel={name} />;
  return (
    <View
      style={dims}
      className={cn(
        'items-center justify-center',
        tone === 'white' ? 'bg-card-nested' : 'bg-card',
        className,
      )}
    >
      <Text variant="bodyMedium" className={cn('font-semibold', FONT[size])}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}
