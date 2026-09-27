import { Text } from '@movo/design-system';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { levelById, model } from './spatial/model';
import { destinations } from './spatial/nav';
import type { NavNode } from './spatial/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (node: NavNode) => void;
}

function labelOf(n: NavNode): string {
  const level = levelById(n.levelId);
  const code = n.space ?? '';
  const flat = /\/F(\d{3})\//.exec(code)?.[1];
  const base = n.name ?? n.kind;
  const where = flat ? `${flat} · ${base}` : base;
  return level ? `${where}  (${level.name})` : where;
}

/** Simple list of every reachable place, filtered by text. */
export function DestinationPicker({ open, onClose, onPick }: Props) {
  const { t } = useTranslation(['ar', 'common']);
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const all = destinations(model).map((n) => ({ n, label: labelOf(n) }));
    const needle = q.trim().toLowerCase();
    const list = needle ? all.filter((i) => i.label.toLowerCase().includes(needle)) : all;
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [q]);
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center px-5 pb-3">
          <Text className="flex-1 text-lg font-semibold">{t('ar:pickDestination')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} className="px-3 py-2">
            <Text>{t('common:close', { defaultValue: 'Close' })}</Text>
          </Pressable>
        </View>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="301, kitchen, lift…"
          className="mx-5 mb-2 rounded-xl bg-card px-4 py-3"
          autoCorrect={false}
        />
        <FlatList
          data={items}
          keyExtractor={(i) => i.n.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onPick(item.n);
                onClose();
              }}
              className="border-b border-line px-5 py-3"
            >
              <Text>{item.label}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}
