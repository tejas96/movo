import { type AuditArea, AuditAreaSchema, type AuditEntry, ModuleKeySchema } from '@movo/contracts';
import {
  Card,
  Chip,
  EmptyState,
  photos,
  Row,
  Screen,
  Sheet,
  Skeleton,
  Text,
  TitleBar,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { dateTime, relative } from '../../core/util/time';
import { useAuditLog } from './api';
import { i18nKey } from './module-settings';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x !== 'object'))
    return v.length ? v.join(', ') : '—';
  return JSON.stringify(v);
}

/** Top-level fields that differ between before and after, flattened one level for settings. */
export function changes(
  before: unknown,
  after: unknown,
): { field: string; from: string; to: string }[] {
  const b = isObj(before) ? before : {};
  const a = isObj(after) ? after : {};
  const out: { field: string; from: string; to: string }[] = [];
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    const x = b[key];
    const y = a[key];
    if (isObj(x) || isObj(y)) {
      for (const sub of changes(x, y)) out.push({ ...sub, field: `${key}.${sub.field}` });
      continue;
    }
    if (JSON.stringify(x) !== JSON.stringify(y))
      out.push({ field: key, from: key in b ? show(x) : '—', to: key in a ? show(y) : '—' });
  }
  return out;
}

export function AuditLogScreen() {
  const { t } = useTranslation(['manage', 'society', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const [area, setArea] = useState<AuditArea | undefined>(undefined);
  const [open, setOpen] = useState<AuditEntry | null>(null);
  const list = useAuditLog(societyId, area);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  const title = (e: AuditEntry) => {
    const label = t(`manage:audit.actions.${i18nKey(e.action)}`);
    // Module changes name the module, so the list says which switch moved.
    const mod = ModuleKeySchema.safeParse(e.entityId);
    return e.entityType === 'SocietyModule' && mod.success
      ? `${label} · ${t(`society:modules.${mod.data}`)}`
      : label;
  };
  const who = (e: AuditEntry) => e.actor?.displayName ?? t('manage:audit.system');
  const diff = open ? changes(open.before, open.after) : [];

  return (
    <Screen scroll={false}>
      <TitleBar title={t('manage:audit.title')} onBack={() => nav.goBack()} />
      <View className="mt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <Chip
              label={t('manage:audit.all')}
              selected={!area}
              onPress={() => setArea(undefined)}
            />
            {AuditAreaSchema.options.map((a) => (
              <Chip
                key={a}
                label={t(`manage:audit.areas.${a}`)}
                selected={area === a}
                onPress={() => setArea(a)}
              />
            ))}
          </View>
        </ScrollView>
      </View>
      {list.isLoading ? (
        <View className="mt-4 gap-3">
          <Skeleton className="h-[68px]" />
          <Skeleton className="h-[68px]" />
          <Skeleton className="h-[68px]" />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          photo={photos.empty}
          icon="audit"
          title={t('manage:audit.empty')}
          body={t('manage:audit.emptyBody')}
          className="mt-10"
        />
      ) : (
        <FlatList
          className="mt-4"
          data={items}
          keyExtractor={(i) => i.id}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Card tight className="mb-2">
              <Row
                icon="audit"
                title={title(item)}
                subtitle={`${who(item)} · ${relative(item.createdAt)}`}
                onPress={() => setOpen(item)}
              />
            </Card>
          )}
        />
      )}
      <Sheet
        visible={open !== null}
        onClose={() => setOpen(null)}
        title={open ? title(open) : undefined}
      >
        {open ? (
          <View className="gap-3">
            <Text variant="body" tone="secondary">
              {`${who(open)} · ${dateTime(open.createdAt)}`}
            </Text>
            {diff.length > 0 ? (
              <View className="gap-2 rounded-md bg-card p-4">
                {diff.slice(0, 20).map((d) => (
                  <View key={d.field}>
                    <Text variant="caption" tone="secondary">
                      {d.field}
                    </Text>
                    <Text variant="body" numberOfLines={3}>
                      {`${d.from} → ${d.to}`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text variant="body" tone="secondary">
                {t('manage:audit.noDetails')}
              </Text>
            )}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
