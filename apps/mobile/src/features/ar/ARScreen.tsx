import { type ArTrackingState, MovoArView } from '@movo/ar-native';
import { Text } from '@movo/design-system';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useNav } from '../../core/navigation/types';
import { DestinationPicker } from './DestinationPicker';
import { levelKey } from './labels';
import { PLATES } from './plates.generated';
import { useLocalizer } from './spatial/localizer';
import { levelById, spacesOnLevel } from './spatial/model';
import { makeProjector, type ScreenPoint } from './spatial/project';
import type { NavNode } from './spatial/types';
import { useRoute } from './useRoute';

/** Plates with a known pose, in the shape the native side wants. Built once. */
const PLATES_JSON = JSON.stringify(
  PLATES.filter((p) => p.position).map((p) => ({
    id: p.id,
    physicalWidthM: p.physicalWidthM,
    imageBase64: p.imageBase64,
  })),
);

type Perm = 'pending' | 'granted' | 'denied';
let lastLogSec = -1;

/** Camera view. The native side tracks; this screen draws labels and the route on top. */
export function ARScreen() {
  const { t } = useTranslation(['ar', 'common']);
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [perm, setPerm] = useState<Perm>(Platform.OS === 'android' ? 'pending' : 'granted');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tracking, setTracking] = useState<ArTrackingState>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [dest, setDest] = useState<NavNode | null>(null);
  const [picker, setPicker] = useState(false);

  const onPose = useLocalizer((s) => s.onPose);
  const onImage = useLocalizer((s) => s.onImage);
  const setTrk = useLocalizer((s) => s.setTracking);
  const reset = useLocalizer((s) => s.reset);
  const pose = useLocalizer((s) => s.pose);
  const frame = useLocalizer((s) => s.lastFrame);
  const tBlcsFromAr = useLocalizer((s) => s.tBlcsFromAr);
  const levelId = useLocalizer((s) => s.levelId);
  const fixPlate = useLocalizer((s) => s.fixPlateId);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)
      .then((r) => setPerm(r === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied'))
      .catch(() => setPerm('denied'));
  }, []);
  useEffect(() => () => reset(), [reset]);

  const level = levelById(levelId);
  const routeView = useRoute(dest, levelId);

  const overlay = useMemo(() => {
    if (!tBlcsFromAr || !frame || !level || size.w === 0) return null;
    const project = makeProjector(tBlcsFromAr, frame, size.w, size.h);
    const labels = spacesOnLevel(level)
      .map((s) => ({ s, p: project(s.point) }))
      .filter((x) => x.p.visible && x.p.depth < 14)
      .sort((a, b) => a.p.depth - b.p.depth)
      .slice(0, 12);
    if (__DEV__ && labels.length && Math.floor(frame.t / 1000) !== lastLogSec) {
      lastLogSec = Math.floor(frame.t / 1000);
      console.log(
        '[ar] labels',
        'yaw',
        pose ? Math.round(pose.yawDeg) : '?',
        labels.slice(0, 4).map((l) => `${l.s.flat ?? ''}${l.s.name}@(${Math.round(l.p.x)},${Math.round(l.p.y)}) d=${l.p.depth.toFixed(1)}`).join(' | '),
        'of',
        labels.length,
      );
    }
    const runs: ScreenPoint[][] = [];
    if (routeView) {
      let cur: ScreenPoint[] = [];
      for (const pt of routeView.points) {
        const sp = project(pt);
        if (sp.visible) cur.push(sp);
        else if (cur.length) {
          runs.push(cur);
          cur = [];
        }
      }
      if (cur.length) runs.push(cur);
    }
    return { labels, runs };
  }, [tBlcsFromAr, frame, level, size, routeView]);

  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const hint = (() => {
    if (perm === 'denied') return t('ar:status.permission');
    if (tracking === 'notAvailable') return t('ar:status.notAvailable');
    if (error) return error;
    if (!tBlcsFromAr) return t('ar:hint.noFix');
    if (tracking === 'limited') return t('ar:hint.tracking');
    if (routeView?.next) return t('ar:route.next', { name: routeView.next.name ?? routeView.next.kind });
    return null;
  })();

  return (
    <View className="flex-1 bg-black" onLayout={onLayout}>
      {perm === 'granted' ? (
        <MovoArView
          style={StyleSheet.absoluteFill}
          plates={PLATES_JSON}
          active
          poseHz={15}
          onPose={(e) => onPose(e.nativeEvent)}
          onImage={(e) => onImage(e.nativeEvent)}
          onTrackingState={(e) => {
            if (__DEV__) console.log('[ar] tracking', e.nativeEvent.state, e.nativeEvent.reason ?? '');
            setTracking(e.nativeEvent.state);
            setTrk(e.nativeEvent.state);
          }}
          onError={(e) => {
            if (__DEV__) console.log('[ar] error', e.nativeEvent.code, e.nativeEvent.message);
            setError(e.nativeEvent.message);
          }}
        />
      ) : null}

      {overlay && size.w > 0 ? (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={size.w} height={size.h}>
          {overlay.runs.map((run, i) => (
            <Polyline
              key={`r${i}`}
              points={run.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
              stroke="#ffb000"
              strokeWidth={6}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          ))}
          {overlay.labels.map((l, i) => (
            <Circle key={`${l.s.code}#${i}`} cx={l.p.x} cy={l.p.y} r={5} fill="#ffffff" stroke="#000" strokeWidth={1} />
          ))}
        </Svg>
      ) : null}

      {overlay?.labels.map((l, i) => (
        <View
          key={`${l.s.code}#${i}`}
          pointerEvents="none"
          style={{ position: 'absolute', left: l.p.x - 70, top: l.p.y - 42, width: 140 }}
          className="items-center"
        >
          <View className="rounded-full bg-black/70 px-3 py-1">
            <Text className="text-xs text-white" center>
              {(l.s.flat ? `${l.s.flat} · ` : '') + l.s.name}
            </Text>
          </View>
        </View>
      ))}

      <View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12 }} className="flex-row items-center gap-2">
        <Pressable accessibilityRole="button" onPress={() => nav.goBack()} className="rounded-full bg-black/60 px-4 py-2">
          <Text className="text-white">{t('common:back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <View className="rounded-full bg-black/60 px-4 py-2">
          <Text className="text-white">
            {level ? t('ar:status.level', { level: t(levelKey(level.id)) }) : t('ar:status.noFloor')}
            {pose ? `  ·  ${t('ar:status.confidence', { pct: Math.round(pose.confidence * 100) })}` : ''}
          </Text>
        </View>
      </View>

      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 12, right: 12 }} className="gap-2">
        {hint ? (
          <View className="rounded-2xl bg-black/70 px-4 py-3">
            <Text className="text-white">{hint}</Text>
            {perm === 'denied' ? (
              <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} className="mt-2">
                <Text className="text-white underline">{t('ar:status.openSettings')}</Text>
              </Pressable>
            ) : null}
            {fixPlate && !routeView ? <Text className="mt-1 text-xs text-white/70">{fixPlate}</Text> : null}
          </View>
        ) : null}
        {routeView ? (
          <View className="rounded-2xl bg-black/70 px-4 py-3">
            <Text className="text-white">
              {t('ar:route.summary', { steps: routeView.route.nodes.length - 1, seconds: Math.round(routeView.route.totalS) })}
            </Text>
          </View>
        ) : null}
        <View className="flex-row gap-2">
          <Pressable accessibilityRole="button" onPress={() => setPicker(true)} className="flex-1 items-center rounded-full bg-white px-4 py-3">
            <Text>{dest ? (dest.name ?? dest.kind) : t('ar:whereTo')}</Text>
          </Pressable>
          {dest ? (
            <Pressable accessibilityRole="button" onPress={() => setDest(null)} className="items-center rounded-full bg-white/80 px-4 py-3">
              <Text>{t('ar:clearRoute')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.navigate('FloorMap', { levelId: levelId ?? undefined, destinationId: dest?.id })}
            className="items-center rounded-full bg-white/80 px-4 py-3"
          >
            <Text>{t('ar:map')}</Text>
          </Pressable>
        </View>
      </View>

      <DestinationPicker open={picker} onClose={() => setPicker(false)} onPick={setDest} />
    </View>
  );
}
