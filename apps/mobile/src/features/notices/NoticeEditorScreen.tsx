import { type NoticeCategory, NoticeCategorySchema } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Input,
  OptionSheet,
  Screen,
  Segmented,
  SelectField,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { useCreateNotice, useNotice, useUpdateNotice } from './api';

type Priority = 'NORMAL' | 'IMPORTANT' | 'EMERGENCY';

export function NoticeEditorScreen() {
  const { t } = useTranslation(['notices', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const noticeId = useRoute<RouteProp<RootStackParamList, 'NoticeEditor'>>().params?.noticeId;
  const existing = useNotice(societyId, noticeId ?? '');
  const create = useCreateNotice(societyId);
  const update = useUpdateNotice(societyId, noticeId ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('GENERAL');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [pinned, setPinned] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noticeId || !existing.data) return;
    setTitle(existing.data.title);
    setBody(existing.data.body);
    setCategory(existing.data.category);
    setPriority(existing.data.priority);
    setPinned(existing.data.isPinned);
  }, [noticeId, existing.data]);

  const save = async (publish: boolean) => {
    setError(null);
    if (title.trim().length < 2 || body.trim().length < 1) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      if (noticeId) {
        await update.mutateAsync({
          title: title.trim(),
          body: body.trim(),
          category,
          priority,
          isPinned: pinned,
        });
      } else {
        await create.mutateAsync({
          title: title.trim(),
          body: body.trim(),
          category,
          priority,
          isPinned: pinned,
          publish,
          audience: { type: 'ALL' },
        });
      }
      toast.show(publish ? t('notices:form.published') : t('common:actions.done'));
      nav.goBack();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  const busy = create.isPending || update.isPending;
  const categoryOptions = NoticeCategorySchema.options.map((c) => ({
    value: c,
    label: t(`notices:category.${c}`),
  }));

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={noticeId ? t('common:actions.edit') : t('notices:new')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6 gap-3">
          <Input
            label={t('notices:form.title')}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <Input
            label={t('notices:form.body')}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={5000}
            style={{ minHeight: 140, textAlignVertical: 'top', paddingTop: 12 }}
            containerClassName=""
          />
          <SelectField
            label={t('notices:form.category')}
            value={t(`notices:category.${category}`)}
            onPress={() => setCategoryOpen(true)}
          />
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('notices:form.priority')}
            </Text>
            <Segmented
              value={priority}
              onChange={setPriority}
              options={[
                { value: 'NORMAL', label: t('notices:priority.NORMAL') },
                { value: 'IMPORTANT', label: t('notices:priority.IMPORTANT') },
                { value: 'EMERGENCY', label: t('notices:priority.EMERGENCY') },
              ]}
            />
          </View>
          <View className="flex-row items-center justify-between rounded-md bg-card px-[18px] py-3">
            <Text variant="body">{t('notices:form.pin')}</Text>
            <Toggle value={pinned} onValueChange={setPinned} />
          </View>
          <Text variant="label" tone="secondary">
            {t('notices:form.audienceAll')}
          </Text>
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      </Screen>
      <BottomBar
        action={
          <View className="flex-row items-center gap-2">
            {!noticeId ? (
              <Button
                label={t('notices:form.saveDraft')}
                variant="gray"
                inline
                size="sm"
                onPress={() => void save(false)}
                disabled={busy}
              />
            ) : null}
            <Button
              label={noticeId ? t('common:actions.save') : t('notices:form.publish')}
              inline
              onPress={() => void save(true)}
              loading={busy}
            />
          </View>
        }
      />
      <OptionSheet
        visible={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title={t('notices:form.category')}
        options={categoryOptions}
        value={category}
        onSelect={setCategory}
      />
    </>
  );
}
