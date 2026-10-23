import { useEffect, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { cn } from './cn';

export interface SkeletonProps extends ViewProps {
  className?: string;
}

/** Gray block with a soft light band sweeping across it. Size it with className (h-*, w-*, rounded-*). */
export function Skeleton({ className, style, onLayout, ...rest }: SkeletonProps) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!width) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1300, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [x, width]);

  const band = Math.max(80, width * 0.6);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-band, width] });

  return (
    <View
      {...rest}
      onLayout={(e: LayoutChangeEvent) => {
        setWidth(e.nativeEvent.layout.width);
        onLayout?.(e);
      }}
      style={style}
      className={cn('overflow-hidden bg-card rounded-md', className)}
    >
      {width ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { width: band, transform: [{ translateX }] }]}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.7" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#shimmer)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
