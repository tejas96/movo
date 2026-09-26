import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, View } from 'react-native';
import type { IconName } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { Text } from './Text';
import { theme } from './theme';

export interface HoldButtonProps {
  label: string;
  /** Shown while the finger is down. */
  holdingLabel?: string;
  icon?: IconName;
  /** Fires once, when the hold completes. */
  onConfirm: () => void;
  durationMs?: number;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * Press and hold to confirm. For actions that must never fire from a stray tap, like an
 * emergency alert. A darker fill grows left to right; letting go early resets it.
 * Screen readers get a "long press" action that confirms directly.
 */
export function HoldButton({
  label,
  holdingLabel,
  icon = 'emergency',
  onConfirm,
  durationMs = 1500,
  disabled,
  loading,
  className,
}: HoldButtonProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const [width, setWidth] = useState(0);
  const done = useRef(false);
  const isDisabled = Boolean(disabled || loading);

  useEffect(() => () => progress.stopAnimation(), [progress]);

  const start = () => {
    if (isDisabled) return;
    done.current = false;
    setHolding(true);
    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      done.current = true;
      setHolding(false);
      onConfirm();
      Animated.timing(progress, { toValue: 0, duration: 250, useNativeDriver: false }).start();
    });
  };

  const cancel = () => {
    if (done.current) return;
    setHolding(false);
    progress.stopAnimation();
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      accessibilityActions={[{ name: 'longpress', label }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress' && !isDisabled) onConfirm();
      }}
      onPressIn={start}
      onPressOut={cancel}
      disabled={isDisabled}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className={cn(
        'h-control-lg w-full overflow-hidden rounded-full bg-danger',
        isDisabled && 'opacity-disabled',
        className,
      )}
    >
      <Animated.View
        pointerEvents="none"
        style={{ width: fill, backgroundColor: 'rgba(0, 0, 0, 0.28)' }}
        className="absolute bottom-0 left-0 top-0"
      />
      <View className="flex-1 flex-row items-center justify-center gap-2">
        {loading ? (
          <ActivityIndicator color={theme.color.text.onInk} size="small" />
        ) : (
          <>
            <Icon name={icon} variant="bold" size={20} color={theme.color.text.onInk} />
            <Text variant="bodyMedium" style={{ color: theme.color.text.onInk }}>
              {holding && holdingLabel ? holdingLabel : label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}
