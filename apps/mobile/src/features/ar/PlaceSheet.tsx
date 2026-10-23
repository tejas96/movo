import { Icon, Sheet, Text, theme } from '@movo/design-system';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { levelKey } from './labels';
import { type LabelledSpace, levelById, levels, spacesOnLevel } from './spatial/model';

export interface PlacePick {
  levelId: string;
  /** BLCS mm */
  x: number;
  y: number;
  label: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (p: PlacePick) => void;
  /** the user's own flat number, e.g. "302" */
  myFlat: string | null;
  /** level to open on; falls back to the user's floor, then the ground floor */
  levelId: string | null;
}

const COMMON = new Set(['corridor', 'lift', 'stair', 'parking_area', 'terrace']);
/** Level of a flat number: 302 is on L3, 601 on L6. */
export function levelOfFlat(flat: string | null): string | null {
  const m = /^(\d)(\d{2})$/.exec(flat ?? '');
  if (!m) return null;
  const id = `L${m[1]}`;
  return levelById(id) ? id : null;
}

/**
 * "Where are you?" for when no plate is in view. One tap on a flat or a common area is enough;
 * the user's own flat opens with its rooms so they can be exact at home.
 */
export function PlaceSheet({ visible, onClose, onPick, myFlat, levelId }: Props) {
  const { t } = useTranslation(['ar']);
  const [chosenLevel, setChosenLevel] = useState<string | null>(null);
  const [openFlat, setOpenFlat] = useState<string | null>(null);
  const activeLevel = chosenLevel ?? levelId ?? levelOfFlat(myFlat) ?? 'L0';
  const level = levelById(activeLevel) ?? levels[0];

  const places = useMemo(() => {
    if (!level)
      return {
        flats: [] as Array<{ flat: string; rooms: LabelledSpace[] }>,
        common: [] as LabelledSpace[],
      };
    const spaces = spacesOnLevel(level);
    const byFlat = new Map<string, LabelledSpace[]>();
    for (const s of spaces) {
      if (!s.flat) continue;
      const list = byFlat.get(s.flat);
      if (list) list.push(s);
      else byFlat.set(s.flat, [s]);
    }
    const flats = [...byFlat.entries()]
      .map(([flat, rooms]) => ({ flat, rooms: rooms.filter((r) => r.subtype !== 'balcony') }))
      .sort((a, b) => a.flat.localeCompare(b.flat));
    const common = spaces.filter((s) => !s.flat && COMMON.has(s.subtype));
    return { flats, common };
  }, [level]);

  const pick = (s: LabelledSpace, label: string) => {
    if (!level) return;
    onPick({ levelId: level.id, x: s.point[0], y: s.point[1], label });
    onClose();
  };
  const mine = places.flats.find((f) => f.flat === myFlat);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('ar:manual.title')}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.levels}
      >
        {levels.map((l) => {
          const on = l.id === level?.id;
          return (
            <Pressable
              key={l.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setChosenLevel(l.id);
                setOpenFlat(null);
              }}
              style={[styles.levelChip, on && styles.levelChipOn]}
            >
              <Text variant="bodyMedium" tone={on ? 'inverse' : 'primary'}>
                {t(levelKey(l.id))}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {mine ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Icon name="home" size={18} color={theme.color.icon.primary} />
            <Text variant="caption" tone="secondary">
              {t('ar:manual.myFlat')} · {t('ar:manual.flat', { flat: mine.flat })}
            </Text>
          </View>
          <View style={styles.wrap}>
            {mine.rooms.map((r) => (
              <Pressable
                key={r.code}
                accessibilityRole="button"
                onPress={() => pick(r, `${mine.flat} · ${r.name}`)}
                style={styles.roomChip}
              >
                <Text variant="bodyMedium">{r.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {places.flats.length > 0 ? (
        <View style={styles.block}>
          <Text variant="caption" tone="secondary" style={styles.blockHead}>
            {t('ar:manual.flats')}
          </Text>
          <View style={styles.wrap}>
            {places.flats
              .filter((f) => f.flat !== myFlat)
              .map((f) => {
                const on = openFlat === f.flat;
                return (
                  <Pressable
                    key={f.flat}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setOpenFlat(on ? null : f.flat)}
                    style={[styles.flatCard, on && styles.flatCardOn]}
                  >
                    <Text variant="title" tone={on ? 'inverse' : 'primary'}>
                      {f.flat}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
          {(() => {
            const f = places.flats.find((x) => x.flat === openFlat && x.flat !== myFlat);
            if (!f) return null;
            return (
              <View style={styles.wrap}>
                {f.rooms.map((r) => (
                  <Pressable
                    key={r.code}
                    accessibilityRole="button"
                    onPress={() => pick(r, `${f.flat} · ${r.name}`)}
                    style={styles.roomChip}
                  >
                    <Text variant="bodyMedium">{r.name}</Text>
                  </Pressable>
                ))}
              </View>
            );
          })()}
        </View>
      ) : null}

      {places.common.length > 0 ? (
        <View style={styles.block}>
          <Text variant="caption" tone="secondary" style={styles.blockHead}>
            {t('ar:manual.common')}
          </Text>
          <View style={styles.wrap}>
            {places.common.map((s) => (
              <Pressable
                key={s.code}
                accessibilityRole="button"
                onPress={() => pick(s, s.name)}
                style={styles.roomChip}
              >
                <Text variant="bodyMedium">{s.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  levels: { gap: 8, paddingBottom: 4 },
  levelChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: theme.color.bg.nested,
  },
  levelChipOn: { backgroundColor: theme.color.bg.ink },
  block: { marginTop: 16, gap: 10 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roomChip: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    justifyContent: 'center',
    backgroundColor: theme.color.bg.nested,
  },
  flatCard: {
    width: 72,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bg.nested,
  },
  flatCardOn: { backgroundColor: theme.color.bg.ink },
});
