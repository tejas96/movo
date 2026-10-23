import { type ArTrackingState, MovoArView } from '@movo/ar-native';
import { Icon, Text, theme } from '@movo/design-system';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, PermissionsAndroid, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useTenant } from '../../core/tenant/hooks';
import {
  ACCENT,
  confidenceHex,
  GLASS,
  GlassPill,
  LayersSheet,
  LegendRow,
  NextStepCard,
  RoundButton,
  ScanReticle,
} from './ArHud';
import { DestinationPicker } from './DestinationPicker';
import { arLog } from './debug';
import { levelKey, nodeKey } from './labels';
import { useArLayers } from './layers';
import { PlaceSheet } from './PlaceSheet';
import { PLATES } from './plates.generated';
import { useLocalizer } from './spatial/localizer';
import { invertRigid } from './spatial/math';
import { levelById, spaceAt } from './spatial/model';
import { buildLevelScene, buildRouteScene, sceneJson } from './spatial/scene';
import { servicesOnLevel } from './spatial/services';
import type { NavNode } from './spatial/types';
import { stepInfo } from './steps';
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

/**
 * Camera view. The native side tracks and draws the building content on the GPU every frame.
 * This screen only decides what to draw (level, layers, route) and shows the HUD, so it re-renders
 * a few times a second at most, never per camera frame.
 */
export function ARScreen() {
  const { t } = useTranslation(['ar', 'common']);
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const myFlat = useTenant().flats[0];
  const [perm, setPerm] = useState<Perm>(Platform.OS === 'android' ? 'pending' : 'granted');
  const [error, setError] = useState<string | null>(null);
  const [dest, setDest] = useState<NavNode | null>(null);
  const [picker, setPicker] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);

  const onPose = useLocalizer((s) => s.onPose);
  const onImage = useLocalizer((s) => s.onImage);
  const setTrk = useLocalizer((s) => s.setTracking);
  // tracking comes with every pose as well as with state events, so the store is the one source
  const tracking = useLocalizer((s) => s.tracking) as ArTrackingState;
  const reset = useLocalizer((s) => s.reset);
  const manualFix = useLocalizer((s) => s.manualFix);
  const fixPlateId = useLocalizer((s) => s.fixPlateId);
  const pose = useLocalizer((s) => s.pose);
  const tBlcsFromAr = useLocalizer((s) => s.tBlcsFromAr);
  const levelId = useLocalizer((s) => s.levelId);
  const layers = useArLayers((s) => s.layers);
  const toggleLayer = useArLayers((s) => s.toggle);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)
      .then((r) => setPerm(r === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied'))
      .catch(() => setPerm('denied'));
  }, []);
  useEffect(() => () => reset(), [reset]);

  const level = levelById(levelId);
  const routeView = useRoute(dest, levelId);

  // What the native side draws. Each piece changes only when its inputs do.
  const anchor = useMemo(() => (tBlcsFromAr ? invertRigid(tBlcsFromAr) : null), [tBlcsFromAr]);
  const services = useMemo(() => (level ? servicesOnLevel(level) : null), [level]);
  // the flat the phone is in: a string, so the scene only rebuilds when it changes, not per pose
  const focusFlat = level && pose ? (spaceAt(level, pose.x, pose.y)?.flat ?? null) : null;
  const scene = useMemo(
    () => (level && services ? sceneJson(buildLevelScene(level, layers, services, focusFlat)) : ''),
    [level, layers, services, focusFlat],
  );
  const route = useMemo(
    () => (level && layers.route ? sceneJson(buildRouteScene(routeView, dest, level)) : ''),
    [level, layers.route, routeView, dest],
  );

  const step = useMemo(() => stepInfo(pose, routeView), [pose, routeView]);
  const nameOf = (n: NavNode) => n.name ?? t(nodeKey(n.kind));

  const banner = (() => {
    if (perm === 'denied') return t('ar:status.permission');
    if (tracking === 'notAvailable') return t('ar:status.notAvailable');
    if (error) return error;
    if (tBlcsFromAr && tracking === 'limited') return t('ar:hint.tracking');
    if (tBlcsFromAr && !fixPlateId) return t('ar:manual.approx');
    return null;
  })();
  const scanning = perm === 'granted' && !tBlcsFromAr && !banner;
  const manual = Boolean(tBlcsFromAr) && !fixPlateId;

  return (
    <View style={styles.root}>
      {perm === 'granted' ? (
        <MovoArView
          style={StyleSheet.absoluteFill}
          plates={PLATES_JSON}
          active
          poseHz={4}
          anchor={anchor}
          scene={scene}
          route={route}
          onPose={(e) => onPose(e.nativeEvent)}
          onImage={(e) => onImage(e.nativeEvent)}
          onTrackingState={(e) => {
            arLog('tracking', e.nativeEvent.state, e.nativeEvent.reason ?? '');
            setTrk(e.nativeEvent.state);
          }}
          onError={(e) => {
            arLog('error', e.nativeEvent.code, e.nativeEvent.message);
            setError(e.nativeEvent.message);
          }}
        />
      ) : null}

      {scanning ? (
        <ScanReticle
          title={tracking === 'initializing' ? t('ar:starting') : t('ar:scan.title')}
          body={t('ar:scan.body')}
          action={t('ar:manual.link')}
          onAction={() => setPlaceOpen(true)}
        />
      ) : null}

      <View style={[styles.top, { top: insets.top + 8 }]}>
        <RoundButton
          icon="back"
          label={t('common:back', { defaultValue: 'Back' })}
          onPress={() => nav.goBack()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('ar:manual.title')}
          onPress={() => setPlaceOpen(true)}
          style={styles.status}
        >
          <GlassPill style={styles.statusPill}>
            {pose ? (
              <View style={[styles.confDot, { backgroundColor: confidenceHex(pose.confidence) }]} />
            ) : null}
            <Text variant="bodyMedium" style={styles.white} numberOfLines={1}>
              {level ? t(levelKey(level.id)) : t('ar:status.noFloor')}
            </Text>
            <Text variant="caption" style={styles.white70} numberOfLines={1}>
              {manual ? t('ar:manual.setBy') : myFlat ? formatFlat(myFlat) : ''}
            </Text>
            <Icon name="edit" size={14} color="rgba(255,255,255,0.72)" />
          </GlassPill>
        </Pressable>
        <RoundButton
          icon="filter"
          label={t('ar:layers.title')}
          onPress={() => setLayersOpen(true)}
        />
      </View>

      {step ? (
        <View style={[styles.stepWrap, { top: insets.top + 64 }]}>
          <NextStepCard
            turn={step.turn}
            title={
              step.turn
                ? t(`ar:step.${step.turn}`)
                : t('ar:step.toward', { name: nameOf(step.next) })
            }
            sub={
              step.after
                ? t('ar:step.then', { name: nameOf(step.after) })
                : t('ar:step.arrive', { name: nameOf(step.next) })
            }
            distance={t('ar:step.metres', { m: Math.round(step.distM) })}
          />
        </View>
      ) : null}

      <View style={[styles.bottom, { bottom: insets.bottom + 16 }]}>
        <LegendRow
          layers={layers}
          labels={{
            water: t('ar:legend.water'),
            drain: t('ar:legend.drain'),
            electric: t('ar:legend.electric'),
          }}
          indicative={t('ar:layers.indicative')}
        />
        {banner ? (
          <Animated.View entering={FadeInDown.duration(260)} style={styles.banner}>
            <Icon name="info" size={18} color="#FFFFFF" />
            <Text variant="caption" style={[styles.white, styles.flex]}>
              {banner}
            </Text>
            {perm === 'denied' ? (
              <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
                <Text variant="caption" style={styles.link}>
                  {t('ar:status.openSettings')}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
        <View style={styles.dock}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPicker(true)}
            style={styles.whereTo}
          >
            <View style={styles.whereIcon}>
              <Icon name={dest ? 'location' : 'search'} size={20} color={theme.color.icon.onInk} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {dest ? nameOf(dest) : t('ar:whereTo')}
              </Text>
              {dest && routeView ? (
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {t('ar:step.metres', { m: Math.round(routeView.route.totalMm / 1000) })}
                  {'  ·  '}
                  {t('ar:step.minutes', {
                    min: Math.max(1, Math.round(routeView.route.totalS / 60)),
                  })}
                </Text>
              ) : null}
            </View>
            {dest ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('ar:end')}
                onPress={() => setDest(null)}
                hitSlop={8}
                style={styles.endBtn}
              >
                <Icon name="close" variant="bold" size={22} color={theme.color.icon.secondary} />
              </Pressable>
            ) : null}
          </Pressable>
          <RoundButton
            icon="map"
            light
            label={t('ar:map')}
            onPress={() =>
              nav.navigate('FloorMap', { levelId: levelId ?? undefined, destinationId: dest?.id })
            }
          />
        </View>
      </View>

      <LayersSheet
        visible={layersOpen}
        onClose={() => setLayersOpen(false)}
        layers={layers}
        onToggle={toggleLayer}
        title={t('ar:layers.title')}
        labels={{
          route: t('ar:layers.route'),
          rooms: t('ar:layers.rooms'),
          water: t('ar:layers.water'),
          drain: t('ar:layers.drain'),
          electric: t('ar:layers.electric'),
        }}
        note={t('ar:layers.note')}
      />
      <PlaceSheet
        visible={placeOpen}
        onClose={() => setPlaceOpen(false)}
        onPick={(p) => manualFix(p.levelId, p.x, p.y)}
        myFlat={myFlat?.number ?? null}
        levelId={levelId}
      />
      <DestinationPicker open={picker} onClose={() => setPicker(false)} onPick={setDest} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  white: { color: '#FFFFFF' },
  white70: { color: 'rgba(255,255,255,0.72)' },
  link: { color: ACCENT, textDecorationLine: 'underline' },
  top: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  status: { flex: 1 },
  statusPill: { justifyContent: 'center' },
  confDot: { width: 8, height: 8, borderRadius: 4 },
  stepWrap: { position: 'absolute', left: 12, right: 12 },
  bottom: { position: 'absolute', left: 12, right: 12, gap: 10 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: GLASS,
  },
  dock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whereTo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  whereIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.color.bg.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: { paddingLeft: 4 },
});
