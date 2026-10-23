import { type ComponentRef, forwardRef, useRef } from 'react';
import { Animated, Pressable, type PressableProps } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressProps extends PressableProps {
  /** Scale while pressed. 0.96 for cards and buttons, 0.92 for small squares. */
  scaleTo?: number;
  className?: string;
}

/**
 * Pressable that shrinks a little under the finger and springs back.
 * Drop-in for Pressable; the colour change on press still comes from `active:` classes.
 */
export const Press = forwardRef<ComponentRef<typeof Pressable>, PressProps>(function Press(
  { scaleTo = 0.96, onPressIn, onPressOut, style, disabled, ...rest },
  ref,
) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 3,
    }).start();
  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      {...rest}
      onPressIn={(e) => {
        if (!disabled) to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      style={[typeof style === 'function' ? undefined : style, { transform: [{ scale }] }]}
    />
  );
});
