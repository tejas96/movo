import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useCycle, useLoop } from '../glow/motion';
import { Text } from '../Text';
import { theme } from '../theme';

/** Avatar tints from the mockup: two pastel colours lit from the top left. */
export const avatarTones = {
  pink: ['#F5A3C7', '#F8CDB0'],
  blue: ['#8FA8E0', '#CDB2F0'],
  sage: ['#BFDDB0', '#F6C7A0'],
  flame: ['#F7B48A', '#F6D35B'],
} as const;

export type AvatarTone = keyof typeof avatarTones;

/** Picks a stable tone for a name, so a person always gets the same colours. */
export function toneFor(key: string): AvatarTone {
  const tones = Object.keys(avatarTones) as AvatarTone[];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return tones[h % tones.length] ?? 'pink';
}

export interface GlowAvatarProps {
  initials: string;
  size?: number;
  tone?: AvatarTone;
  /** White border, for stacks. */
  ring?: boolean;
  /** A thin orange ring that keeps spreading out (committee). */
  pulse?: boolean;
  /** Stagger for the pulse, in ms. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** A soft gradient circle with initials, used for people everywhere in Soft Glow. */
export function GlowAvatar({
  initials,
  size = 46,
  tone = 'pink',
  ring,
  pulse,
  delay = 0,
  style,
}: GlowAvatarProps) {
  const [a, b] = avatarTones[tone];
  const id = `avatar-${tone}`;
  return (
    <View style={[{ width: size, height: size }, style]}>
      {pulse ? <PulseRing size={size} delay={delay} /> : null}
      <View
        style={{
          ...StyleSheet.absoluteFill,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: ring ? 3 : 0,
          borderColor: theme.color.bg.nested,
        }}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id={id} cx="30%" cy="30%" r="80%">
              <Stop offset="0" stopColor={a} />
              <Stop offset="1" stopColor={b} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text
            variant="title"
            className="font-semibold"
            style={{ fontSize: Math.round(size * 0.3) }}
            numberOfLines={1}
          >
            {initials}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** A thin ring that grows to 1.4x and fades every 2.4 s (committee cards). */
export function PulseRing({
  size,
  delay = 0,
  color = '#F0A58A',
}: {
  size: number;
  delay?: number;
  color?: string;
}) {
  const p = useCycle(2400, delay);
  const animated = useAnimatedStyle(() => ({
    opacity: 0.8 * (1 - p.value),
    transform: [{ scale: 1 + 0.4 * p.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: size / 2, borderWidth: 2, borderColor: color },
        animated,
      ]}
    />
  );
}

export interface AvatarStackProps {
  /** `id` keeps each avatar stable when two people share initials. */
  people: readonly { id?: string; initials: string; tone?: AvatarTone }[];
  /** "+139": shown as a last ink circle. */
  more?: string;
  size?: number;
  /** Each avatar bobs on its own beat (Home members card). */
  bob?: boolean;
}

/** Overlapping avatars, 10 dp apart, as on the Home members card and the event going row. */
export function AvatarStack({ people, more, size = 34, bob }: AvatarStackProps) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {people.map((person, i) => (
        <Bobbing key={person.id ?? person.initials} on={Boolean(bob)} delay={i * 300}>
          <GlowAvatar
            initials={person.initials}
            tone={person.tone ?? toneFor(person.initials)}
            size={size}
            ring
            style={{ marginLeft: i === 0 ? 0 : -10 }}
          />
        </Bobbing>
      ))}
      {more ? (
        <Bobbing on={Boolean(bob)} delay={people.length * 300}>
          <View
            style={{
              width: size,
              height: size,
              marginLeft: -10,
              borderRadius: size / 2,
              borderWidth: 3,
              borderColor: theme.color.bg.nested,
              backgroundColor: theme.color.bg.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="micro" tone="inverse" style={{ fontSize: 10 }} numberOfLines={1}>
              {more}
            </Text>
          </View>
        </Bobbing>
      ) : null}
    </View>
  );
}

function Bobbing({
  on,
  delay,
  children,
}: {
  on: boolean;
  delay: number;
  children: React.ReactNode;
}) {
  const p = useLoop(1300, delay);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: on ? -6 * p.value : 0 }],
  }));
  return <Animated.View style={animated}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
