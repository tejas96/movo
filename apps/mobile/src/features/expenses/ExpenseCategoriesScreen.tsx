import type { ExpenseCategory } from '@movo/contracts';
import {
  Button,
  Card,
  IconSquare,
  Input,
  Row,
  Screen,
  Sheet,
  Skeleton,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { CATEGORY_ICON } from '../../core/ui/category-icon';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { useDeleteCategory, useExpenseCategories, useSaveCategory } from './api';
import { expenseCategoryLabel } from './shared';

export function ExpenseCategoriesScreen() {
  const { t } = useTranslation(['expenses', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const categories = useExpenseCategories(societyId);
  const save = useSaveCategory(societyId);
  const remove = useDeleteCategory(societyId);
  const [editing, setEditing] = useState<ExpenseCategory | 'new' | null>(null);
  const [name, setName] = useState('');

  const open = (c: ExpenseCategory | 'new') => {
    setEditing(c);
    setName(c === 'new' ? '' : expenseCategoryLabel(c));
  };

  const submit = async () => {
    await withErrorToast(async () => {
      await save.mutateAsync({
        id: editing && editing !== 'new' ? editing.id : undefined,
        name: name.trim(),
      });
      toast.show(t('expenses:categories.saved'));
      setEditing(null);
    });
  };

  const drop = async () => {
    if (!editing || editing === 'new') return;
    await withErrorToast(async () => {
      await remove.mutateAsync(editing.id);
      toast.show(t('expenses:categories.removed'));
      setEditing(null);
    });
  };

  return (
    <Screen>
      <TitleBar
        title={t('expenses:categories.title')}
        onBack={() => nav.goBack()}
        trailing={<IconSquare icon="add" variant="linear" tone="ink" onPress={() => open('new')} />}
      />
      {categories.isLoading ? (
        <Skeleton className="mt-6 h-64 rounded-xl" />
      ) : loadFailed(categories) ? (
        <QueryError query={categories} className="mt-6" />
      ) : (
        <Card tight className="mt-6 gap-2">
          {(categories.data ?? []).map((c) => (
            <Row
              key={c.id}
              icon={CATEGORY_ICON[c.icon]}
              title={expenseCategoryLabel(c)}
              onPress={() => open(c)}
            />
          ))}
        </Card>
      )}
      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('expenses:categories.add') : t('common:actions.edit')}
        footer={
          <View className="gap-2">
            <Button
              label={t('common:actions.save')}
              loading={save.isPending}
              disabled={name.trim().length < 2}
              onPress={() => void submit()}
            />
            {editing && editing !== 'new' ? (
              <Button
                label={t('expenses:categories.remove')}
                variant="ghost"
                loading={remove.isPending}
                onPress={() => void drop()}
              />
            ) : null}
          </View>
        }
      >
        <Input
          white
          label={t('expenses:categories.name')}
          value={name}
          onChangeText={setName}
          maxLength={40}
        />
      </Sheet>
    </Screen>
  );
}
