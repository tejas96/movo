import { Text } from '@movo/design-system';
import { useRoute as useNavRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Polygon, Polyline, Rect } from 'react-native-svg';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { DestinationPicker } from './DestinationPicker';
import { levelKey } from './labels';
import { useLocalizer } from './spatial/localizer';
import { levelById, levels, model, spacesOnLevel } from './spatial/model';
import type { NavNode } from './spatial/types';
import { useRoute } from './useRoute';

const FILL: Record<string, string> = {
  living: '#ffe9c9',
  kitchen: '#fff6b3',
  bedroom: '#dbe4ff',
  toilet: '#cdeff0',
  balcony: '#d8f5d8',
  terrace: '#cdeccd',
  passage: '#efefef',
  corridor: '#ece4f7',
  shaft: '#dedede',
  lift: '#c9c9ff',
  stair: '#ffd6d6',
  parking_area: '#f6f6f6',
};

type Props = NativeStackScreenProps<RootStackParamList, 'FloorMap'>;

/** Plan view of one level. Works without the camera. Shows the blue dot when the AR guide has a fix. */
export function FloorMapScreen(_props: Props) {
  const { t } = useTranslation(['ar', 'common']);
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useNavRoute().params as RootStackParamList['FloorMap'];
  const pose = useLocalizer((s) => s.pose);
  const [levelId, setLevelId] = useState(params?.levelId ?? pose?.levelId ?? 'L0');
  const [dest, setDest] = useState<NavNode | null>(
    () => model.building.nav.nodes.find((n) => n.id === params?.destinationId) ?? null,
  );
  const [picker, setPicker] = useState(false);
  const level = levelById(levelId) ?? levels[0] ?? model.building.levels[0]!;
  const routeView = useRoute(dest, level.id);

  const plan = useMemo(() => {
    const spaces = spacesOnLevel(level);
    const tpl = level.template ? model.building.templates[level.template] : undefined;
    const columns = (tpl?.elements ?? []).filter((e) => e.subtype === 'column');
    const pts = spaces.flatMap((s) => s.polygon);
    if (pts.length === 0) return null;
    const xs = pts.map((p) => p[0] ?? 0);
    const ys = pts.map((p) => p[1] ?? 0);
    const minX = Math.min(...xs) - 500;
    const maxX = Math.max(...xs) + 500;
    const minY = Math.min(...ys) - 500;
    const maxY = Math.max(...ys) + 500;
    const w = width - 32;
    const scale = w / (maxX - minX);
    const h = (maxY - minY) * scale;
    const X = (x: number) => (x - minX) * scale;
    const Y = (y: number) => h - (y - minY) * scale;
    return { spaces, columns, w, h, X, Y, scale };
  }, [level, width]);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center px-4 pb-2">
        <Pressable accessibilityRole="button" onPress={() => nav.goBack()} className="pr-3 py-2">
          <Text>{t('common:back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text className="flex-1 text-lg font-semibold">{t('ar:map')}</Text>
        <Pressable accessibilityRole="button" onPress={() => nav.navigate('AR')} className="rounded-full bg-ink px-4 py-2">
          <Text className="text-white">{t('ar:camera')}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {levels.map((l) => (
          <Pressable
            key={l.id}
            accessibilityRole="button"
            onPress={() => setLevelId(l.id)}
            className={l.id === level.id ? 'rounded-full bg-ink px-4 py-2' : 'rounded-full bg-card px-4 py-2'}
          >
            <Text className={l.id === level.id ? 'text-white' : undefined}>{t(levelKey(l.id))}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
        {plan ? (
          <Svg width={plan.w} height={plan.h}>
            {plan.spaces.map((s) => (
              <Polygon
                key={s.code}
                points={s.polygon.map((p) => `${plan.X(p[0] ?? 0)},${plan.Y(p[1] ?? 0)}`).join(' ')}
                fill={FILL[s.subtype] ?? '#f0f0f0'}
                stroke="#777"
                strokeWidth={1}
              />
            ))}
            {plan.columns.map((c) => {
              const P = c.geometry.coords as number[][];
              return <Polygon key={c.code} points={P.map((p) => `${plan.X(p[0] ?? 0)},${plan.Y(p[1] ?? 0)}`).join(' ')} fill="#8a2a8a" />;
            })}
            {routeView ? (
              <Polyline
                points={routeView.route.nodes
                  .filter((n) => n.levelId === level.id)
                  .map((n) => `${plan.X(n.p[0])},${plan.Y(n.p[1])}`)
                  .join(' ')}
                stroke="#ffb000"
                strokeWidth={4}
                fill="none"
                strokeLinejoin="round"
              />
            ) : null}
            {dest && dest.levelId === level.id ? (
              <Circle cx={plan.X(dest.p[0])} cy={plan.Y(dest.p[1])} r={7} fill="#ffb000" stroke="#000" strokeWidth={1} />
            ) : null}
            {pose && pose.levelId === level.id ? (
              <>
                <Circle cx={plan.X(pose.x)} cy={plan.Y(pose.y)} r={9} fill="#2f5fd0" stroke="#fff" strokeWidth={2} />
                <Rect
                  x={plan.X(pose.x) - 2}
                  y={plan.Y(pose.y) - 18}
                  width={4}
                  height={12}
                  fill="#2f5fd0"
                  transform={`rotate(${pose.yawDeg} ${plan.X(pose.x)} ${plan.Y(pose.y)})`}
                />
              </>
            ) : null}
          </Svg>
        ) : null}
        <Text className="mt-3 text-xs">
          {pose && pose.levelId === level.id
            ? t('ar:status.confidence', { pct: Math.round(pose.confidence * 100) })
            : t('ar:hint.noFix')}
        </Text>
        {routeView ? (
          <Text className="mt-2">
            {t('ar:route.summary', { steps: routeView.route.nodes.length - 1, seconds: Math.round(routeView.route.totalS) })}
          </Text>
        ) : null}
      </ScrollView>
      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16 }} className="flex-row gap-2">
        <Pressable accessibilityRole="button" onPress={() => setPicker(true)} className="flex-1 items-center rounded-full bg-ink px-4 py-3">
          <Text className="text-white">{dest ? (dest.name ?? dest.kind) : t('ar:whereTo')}</Text>
        </Pressable>
        {dest ? (
          <Pressable accessibilityRole="button" onPress={() => setDest(null)} className="items-center rounded-full bg-card px-4 py-3">
            <Text>{t('ar:clearRoute')}</Text>
          </Pressable>
        ) : null}
      </View>
      <DestinationPicker open={picker} onClose={() => setPicker(false)} onPick={setDest} />
    </View>
  );
}
