import {
  type Notice,
  type NoticeCategory,
  NoticeCategorySchema,
  noticesContract,
} from '@movo/contracts';
import {
  BottomBar,
  Button,
  Card,
  Input,
  OptionSheet,
  Screen,
  Segmented,
  SelectField,
  Text,
  TextArea,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { bodyResolver, formMessage, usePrefill } from '../../core/forms/contract-form';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { useCreateNotice, useNotice, useUpdateNotice } from './api';

type Priority = 'NORMAL' | 'IMPORTANT' | 'EMERGENCY';

interface NoticeForm {
  title: string;
  body: string;
  category: NoticeCategory;
  priority: Priority;
  pinned: boolean;
}

const EMPTY: NoticeForm = {
  title: '',
  body: '',
  category: 'GENERAL',
  priority: 'NORMAL',
  pinned: false,
};

function toForm(n: Notice): NoticeForm {
  return {
    title: n.title,
    body: n.body,
    category: n.category,
    priority: n.priority,
    pinned: n.isPinned,
  };
}

/** The fields both create and update send; create adds `publish` and `audience`. */
function toBody(v: NoticeForm) {
  return {
    title: v.title.trim(),
    body: v.body.trim(),
    category: v.category,
    priority: v.priority,
    isPinned: v.pinned,
  };
}

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
  const [categoryOpen, setCategoryOpen] = useState(false);
  const form = useForm<NoticeForm>({
    resolver: bodyResolver(noticesContract.update.body, toBody),
    defaultValues: EMPTY,
    reValidateMode: 'onSubmit',
  });
  usePrefill(form, noticeId ? existing.data : undefined, toForm);
  const error = formMessage(form, t('common:validation.required'));
  const { category, priority, pinned } = form.watch();

  const save = (publish: boolean) =>
    form.handleSubmit(async (values) => {
      try {
        if (noticeId) {
          await update.mutateAsync(toBody(values));
        } else {
          await create.mutateAsync({ ...toBody(values), publish, audience: { type: 'ALL' } });
        }
        toast.show(publish ? t('notices:form.published') : t('common:actions.done'));
        nav.goBack();
      } catch (e) {
        form.setError('root.server', { message: toMessage(e) });
      }
    })();

  const busy = create.isPending || update.isPending;
  const categoryOptions = NoticeCategorySchema.options.map((c) => ({
    value: c,
    label: t(`notices:category.${c}`),
  }));

  if (noticeId && loadFailed(existing))
    return (
      <Screen>
        <TitleBar title={t('common:actions.edit')} onBack={() => nav.goBack()} />
        <QueryError query={existing} className="mt-10" />
      </Screen>
    );

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={noticeId ? t('common:actions.edit') : t('notices:new')}
          onBack={() => nav.goBack()}
        />
        <Card className="mt-5 gap-3.5">
          <Controller
            control={form.control}
            name="title"
            render={({ field }) => (
              <Input
                label={t('notices:form.title')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={120}
              />
            )}
          />
          <Controller
            control={form.control}
            name="body"
            render={({ field }) => (
              <TextArea
                label={t('notices:form.body')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={5000}
                minHeight={140}
                containerClassName=""
              />
            )}
          />
          <SelectField
            label={t('notices:form.category')}
            value={t(`notices:category.${category}`)}
            onPress={() => setCategoryOpen(true)}
          />
          <View>
            <Text variant="caption" className="mb-1.5 pl-1.5 font-medium">
              {t('notices:form.priority')}
            </Text>
            <Segmented
              value={priority}
              onChange={(p) => form.setValue('priority', p)}
              options={[
                { value: 'NORMAL', label: t('notices:priority.NORMAL') },
                { value: 'IMPORTANT', label: t('notices:priority.IMPORTANT') },
                { value: 'EMERGENCY', label: t('notices:priority.EMERGENCY') },
              ]}
            />
          </View>
          <View className="flex-row items-center justify-between rounded-[22px] bg-card-nested px-[18px] py-3">
            <Text variant="body">{t('notices:form.pin')}</Text>
            <Toggle value={pinned} onValueChange={(v) => form.setValue('pinned', v)} />
          </View>
          <Text variant="label" tone="secondary">
            {t('notices:form.audienceAll')}
          </Text>
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </Card>
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
        onSelect={(c) => form.setValue('category', c)}
      />
    </>
  );
}
