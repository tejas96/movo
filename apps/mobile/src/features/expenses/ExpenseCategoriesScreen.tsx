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
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { CATEGORY_ICON } from '../services/shared';
import { useDeleteCategory, useExpenseCategories, useSaveCategory } from './api';
import { expenseCategoryLabel } from './shared';

export function ExpenseCategoriesScreen() {
  const { t } = useTranslation(['expenses', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
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
    try {
      await save.mutateAsync({
        id: editing && editing !== 'new' ? editing.id : undefined,
        name: name.trim(),
      });
      toast.show(t('expenses:categories.saved'));
      setEditing(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const drop = async () => {
    if (!editing || editing === 'new') return;
    try {
      await remove.mutateAsync(editing.id);
      toast.show(t('expenses:categories.removed'));
      setEditing(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
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
      ) : (
        <Card tight className="mt-6 gap-1">
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
