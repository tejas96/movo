import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar } from './Avatar';
import { cn } from './cn';
import { useInGlass } from './glow/in-glass';
import { Icon } from './Icon';
import { Text } from './Text';

export interface PersonCardProps {
  name: string;
  role?: string | undefined;
  avatarUri?: string | null | undefined;
  verified?: boolean;
  /** Round action buttons on the right (call, chat). */
  actions?: ReactNode;
  onPress?: () => void;
  white?: boolean;
  className?: string;
}

/** A person on glass: glowing avatar, name with badge, role, round actions on the right. */
export function PersonCard({
  name,
  role,
  avatarUri,
  verified,
  actions,
  onPress,
  white,
  className,
}: PersonCardProps) {
  const body = (
    <>
      <Avatar name={name} uri={avatarUri} />
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          <Text variant="title" numberOfLines={1} className="shrink">
            {name}
          </Text>
          {verified ? <Icon name="verified" variant="bold" size={16} /> : null}
        </View>
        {role ? (
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {role}
          </Text>
        ) : null}
      </View>
      {actions ? <View className="flex-row items-center gap-2">{actions}</View> : null}
    </>
  );
  const inGlass = useInGlass();
  const cls = cn(
    'flex-row items-center gap-3 rounded-[24px] p-2.5 pr-3',
    white ? 'bg-card-nested' : inGlass ? 'bg-transparent' : 'bg-card border-[1.5px] border-glass',
    className,
  );
  if (!onPress) return <View className={cls}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={cn(cls, 'active:opacity-pressed')}
    >
      {body}
    </Pressable>
  );
}
