import type { VendorCategory } from '@movo/contracts';
import {
  Button,
  Card,
  EmptyState,
  IconSquare,
  Row,
  Screen,
  SearchBar,
  SectionHeader,
  Skeleton,
  Tile,
  TitleBar,
} from '@movo/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { useCan, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { useVendorCategories, useVendors } from './api';
import { CATEGORY_ICON, categoryLabel, VendorRow } from './shared';

const PADS = ['pad-a', 'pad-b'] as const;

export function ServicesScreen() {
  const { t } = useTranslation(['services', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const canManage = useCan('vendor.manage');
  const canSuggest =
    canManage ||
    Boolean(tenant.modules.find((m) => m.key === 'vendors')?.settings.membersCanSuggest ?? true);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);
  const categories = useVendorCategories(societyId);
  const results = useVendors(societyId, { q }, q.length > 0);
  const suggestions = useVendors(societyId, { status: 'SUGGESTED' }, canManage);
  const suggestionCount = suggestions.data?.length ?? 0;

  const rows: VendorCategory[][] = [];
  const list = categories.data ?? [];
  for (let i = 0; i < list.length; i += 3) rows.push(list.slice(i, i + 3));

  return (
    <Screen refreshing={categories.isRefetching} onRefresh={() => void categories.refetch()}>
      <TitleBar
        title={t('services:title')}
        onBack={() => nav.goBack()}
        trailing={
          canSuggest ? (
            <IconSquare
              icon="add"
              variant="linear"
              accessibilityLabel={canManage ? t('services:add') : t('services:suggest')}
              onPress={() => nav.navigate('VendorEditor')}
            />
          ) : undefined
        }
      />
      <SearchBar
        className="mt-4"
        placeholder={t('services:search')}
        value={text}
        onChangeText={setText}
      />

      {q ? (
        results.isLoading ? (
          <View className="mt-4 gap-3">
            <Skeleton className="h-[68px]" />
            <Skeleton className="h-[68px]" />
          </View>
        ) : (results.data ?? []).length === 0 ? (
          <EmptyState icon="search" title={t('services:noResults')} className="mt-8" />
        ) : (
          <Card tight className="mt-4 gap-2">
            {(results.data ?? []).map((v) => (
              <VendorRow key={v.id} vendor={v} showCategory />
            ))}
          </Card>
        )
      ) : (
        <>
          {canManage && suggestionCount > 0 ? (
            <Card tight className="mt-4">
              <Row
                icon="userAdd"
                title={t('services:suggestions', { count: suggestionCount })}
                onPress={() =>
                  nav.navigate('VendorList', {
                    status: 'SUGGESTED',
                    title: t('services:status.SUGGESTED'),
                  })
                }
              />
            </Card>
          ) : null}
          <SectionHeader title={t('services:categoriesTitle')} />
          {categories.isLoading ? (
            <View className="flex-row gap-3">
              <Skeleton className="h-24 flex-1" />
              <Skeleton className="h-24 flex-1" />
              <Skeleton className="h-24 flex-1" />
            </View>
          ) : list.length === 0 ? (
            <EmptyState
              icon="services"
              title={t('services:empty')}
              body={t('services:emptyBody')}
            />
          ) : (
            <View className="gap-3">
              {rows.map((row) => (
                <View key={row.map((c) => c.id).join('-')} className="flex-row gap-3">
                  {row.map((c) => (
                    <Tile
                      key={c.id}
                      icon={CATEGORY_ICON[c.icon]}
                      label={categoryLabel(c)}
                      hint={t('services:vendorCount', { count: c.vendorCount })}
                      onPress={() =>
                        nav.navigate('VendorList', { categoryId: c.id, title: categoryLabel(c) })
                      }
                    />
                  ))}
                  {row.length < 3
                    ? PADS.slice(0, 3 - row.length).map((pad) => (
                        <View key={pad} className="flex-1" />
                      ))
                    : null}
                </View>
              ))}
            </View>
          )}
          {canManage ? (
            <Button
              label={t('services:categories.manage')}
              variant="gray"
              icon="edit"
              className="mt-6"
              onPress={() => nav.navigate('VendorCategories')}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}
