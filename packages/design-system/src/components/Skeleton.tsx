import { useEffect, useRef } from 'react';
import { Animated, type ViewProps } from 'react-native';
import { cn } from './cn';

export interface SkeletonProps extends ViewProps {
  className?: string;
}

/** Gray block that breathes. Size it with className (h-*, w-*, rounded-*). */
export function Skeleton({ className, style, ...rest }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      {...rest}
      style={[{ opacity }, style]}
      className={cn('bg-card rounded-md', className)}
    />
  );
}
