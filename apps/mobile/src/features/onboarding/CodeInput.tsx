import { Text, theme } from '@movo/design-system';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export interface CodeInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  /** Fires once when the last box is filled. */
  onComplete?: (value: string) => void;
  /** Bump this number to shake the row (wrong code). */
  shake?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

/** Codes use A-Z and 2-9 only (no 0/O/1/I), same as the server. */
const ALLOWED = /[^A-Z2-9]/g;

/**
 * One box per character. A hidden field takes the typing (and paste), the boxes show it.
 * The active box is white with a black edge and a blinking caret.
 */
export function CodeInput({
  length,
  value,
  onChange,
  onComplete,
  shake = 0,
  autoFocus,
  disabled,
}: CodeInputProps) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const shift = useSharedValue(0);
  const caret = useSharedValue(1);

  useEffect(() => {
    caret.value = withRepeat(
      withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })),
      -1,
    );
  }, [caret]);

  useEffect(() => {
    if (!shake) return;
    shift.value = withSequence(
      withTiming(-8, { duration: 50, easing: Easing.linear }),
      withTiming(8, { duration: 90, easing: Easing.linear }),
      withTiming(-6, { duration: 90, easing: Easing.linear }),
      withTiming(4, { duration: 80, easing: Easing.linear }),
      withTiming(0, { duration: 80, easing: Easing.linear }),
    );
  }, [shake, shift]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));

  const update = (raw: string) => {
    const next = raw.toUpperCase().replace(ALLOWED, '').slice(0, length);
    onChange(next);
    if (next.length === length && next !== value) onComplete?.(next);
  };

  const active = Math.min(value.length, length - 1);
  const cells = Array.from({ length }, (_, i) => value[i] ?? '');

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessibilityRole="none"
      disabled={disabled}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.row, rowStyle]}>
        {cells.map((ch, i) => {
          const isActive = focused && i === active && !disabled;
          return (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
              key={i}
              style={[styles.cell, isActive && styles.cellActive]}
            >
              {ch ? (
                <Text variant="h2" style={styles.char}>
                  {ch}
                </Text>
              ) : isActive ? (
                <Animated.View style={[styles.caret, caretStyle]} />
              ) : null}
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={update}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        editable={!disabled}
        caretHidden
        style={styles.hidden}
        accessibilityLabel={`${value.length} of ${length}`}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: {
    flex: 1,
    aspectRatio: 1 / 1.15,
    borderRadius: 16,
    backgroundColor: theme.color.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellActive: { backgroundColor: theme.color.bg.canvas, borderColor: theme.color.bg.ink },
  char: { lineHeight: 28 },
  caret: { width: 2, height: 22, borderRadius: 1, backgroundColor: theme.color.bg.ink },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1, left: 0, top: 0 },
  disabled: { opacity: 0.4 },
});
