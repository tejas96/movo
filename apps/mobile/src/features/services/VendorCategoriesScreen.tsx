import {
  VENDOR_CATEGORY_ICONS,
  type VendorCategory,
  type VendorCategoryIcon,
} from '@movo/contracts';
import {
  Button,
  Card,
  cn,
  Icon,
  IconSquare,
  Input,
  Row,
  Screen,
  Sheet,
  Skeleton,
  Text,
  TitleBar,
  theme,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { useDeleteCategory, useSaveCategory, useVendorCategories } from './api';
import { CATEGORY_ICON, categoryLabel } from './shared';

type Draft = { id?: string; name: string; icon: VendorCategoryIcon; vendorCount: number };

export function VendorCategoriesScreen() {
  const { t } = useTranslation(['services', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const categories = useVendorCategories(societyId);
  const save = useSaveCategory(societyId);
  const remove = useDeleteCategory(societyId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = (c?: VendorCategory) => {
    setError(null);
    setDraft(
      c
        ? { id: c.id, name: categoryLabel(c), icon: c.icon, vendorCount: c.vendorCount }
        : { name: '', icon: 'services', vendorCount: 0 },
    );
  };

  const submit = async () => {
    if (!draft) return;
    if (draft.name.trim().length < 2) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      const original = categories.data?.find((c) => c.id === draft.id);
      const renamed = !original || draft.name.trim() !== categoryLabel(original);
      await save.mutateAsync({
        ...(draft.id ? { categoryId: draft.id } : {}),
        body: {
          // Sending the translated default name back would detach the category from its key.
          name: renamed ? draft.name.trim() : (original?.name ?? draft.name.trim()),
          icon: draft.icon,
        },
      });
      toast.show(t('services:categories.saved'));
      setDraft(null);
    } catch (e) {
      setError(toMessage(e));
    }
  };

  const del = async () => {
    if (!draft?.id) return;
    try {
      await remove.mutateAsync(draft.id);
      toast.show(t('services:categories.deleted'));
      setDraft(null);
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <Screen refreshing={categories.isRefetching} onRefresh={() => void categories.refetch()}>
      <TitleBar
        title={t('services:categories.title')}
        onBack={() => nav.goBack()}
        trailing={
          <IconSquare
            icon="add"
            variant="linear"
            accessibilityLabel={t('services:categories.add')}
            onPress={() => open()}
          />
        }
      />
      {categories.isLoading ? (
        <Skeleton className="mt-6 h-64 rounded-xl" />
      ) : (
        <Card tight className="mt-6 gap-2">
          {(categories.data ?? []).map((c) => (
            <Row
              key={c.id}
              icon={CATEGORY_ICON[c.icon]}
              title={categoryLabel(c)}
              subtitle={t('services:vendorCount', { count: c.vendorCount })}
              onPress={() => open(c)}
            />
          ))}
        </Card>
      )}
      <Sheet
        visible={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('services:categories.edit') : t('services:categories.add')}
        footer={
          <View className="gap-2">
            <Button
              label={t('common:actions.save')}
              onPress={() => void submit()}
              loading={save.isPending}
            />
            {draft?.id && draft.vendorCount === 0 ? (
              <Button
                label={t('common:actions.delete')}
                variant="ghost"
                onPress={() => void del()}
                loading={remove.isPending}
              />
            ) : null}
          </View>
        }
      >
        <Input
          white
          label={t('services:categories.name')}
          value={draft?.name ?? ''}
          onChangeText={(name) => setDraft((d) => (d ? { ...d, name } : d))}
          maxLength={40}
        />
        <Text variant="label" tone="secondary" className="mb-1.5 mt-4">
          {t('services:categories.icon')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {VENDOR_CATEGORY_ICONS.map((icon) => {
            const on = draft?.icon === icon;
            return (
              <Pressable
                key={icon}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={icon}
                onPress={() => setDraft((d) => (d ? { ...d, icon } : d))}
                className={cn(
                  'h-12 w-12 items-center justify-center rounded-sm',
                  on ? 'bg-ink' : 'bg-card-nested active:bg-card',
                )}
              >
                <Icon
                  name={CATEGORY_ICON[icon]}
                  size={22}
                  color={on ? theme.color.icon.onInk : theme.color.icon.primary}
                />
              </Pressable>
            );
          })}
        </View>
        {error ? (
          <Text variant="caption" tone="danger" className="mt-3">
            {error}
          </Text>
        ) : null}
      </Sheet>
    </Screen>
  );
}
