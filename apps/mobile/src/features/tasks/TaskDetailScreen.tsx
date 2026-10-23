import { MAX_TASK_PROOFS } from '@movo/contracts';
import {
  Avatar,
  BottomBar,
  Button,
  Card,
  Divider,
  Glass,
  IconSquare,
  OptionSheet,
  Rise,
  Row,
  Screen,
  SectionHeader,
  Sheet,
  Skeleton,
  Text,
  TextArea,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { MemberPickerSheet } from '../../core/members/MemberPickerSheet';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { PhotoField, usePhotoPicker } from '../../core/photos/PhotoPickerRow';
import { PhotoSection } from '../../core/photos/PhotoStrip';
import { useSocietyId } from '../../core/tenant/hooks';
import { DetailHero, HeroPill } from '../../core/ui/DetailHero';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { day, relative } from '../../core/util/date';
import { type TaskAction, useTask, useTaskAction } from './api';
import { TaskStatusPill } from './shared';

type MenuKey = 'edit' | 'assign' | 'open' | 'cancel';

export function TaskDetailScreen() {
  const { t } = useTranslation(['tasks', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const { taskId } = useRoute<RouteProp<RootStackParamList, 'TaskDetail'>>().params;
  const task = useTask(societyId, taskId);
  const action = useTaskAction(societyId, taskId);
  const [menu, setMenu] = useState(false);
  const [pick, setPick] = useState(false);
  const [sheet, setSheet] = useState<'submit' | 'sendBack' | 'cancel' | null>(null);
  const [text, setText] = useState('');
  const proofs = usePhotoPicker(societyId, { kind: 'TASK_PROOF', max: MAX_TASK_PROOFS });
  const x = task.data;

  const run = async (a: TaskAction, ok: string) => {
    await withErrorToast(async () => {
      await action.mutateAsync(a);
      toast.show(ok);
      setSheet(null);
    });
  };

  const menuOptions: { value: MenuKey; label: string }[] = x?.canManage
    ? [
        { value: 'edit', label: t('common:actions.edit') },
        { value: 'assign', label: t('tasks:actions.assign') },
        ...(x.assignee ? [{ value: 'open' as const, label: t('tasks:actions.openUp') }] : []),
        { value: 'cancel', label: t('tasks:actions.cancel') },
      ]
    : [];

  const primary = x
    ? x.canVolunteer
      ? {
          label: t('tasks:actions.volunteer'),
          onPress: () => void run({ kind: 'volunteer' }, t('tasks:actions.volunteered')),
        }
      : x.canSubmit
        ? {
            label: t('tasks:actions.submit'),
            onPress: () => {
              setText('');
              proofs.reset(x.proofs);
              setSheet('submit');
            },
          }
        : x.canVerify
          ? {
              label: t('tasks:actions.verify'),
              onPress: () => void run({ kind: 'verify' }, t('tasks:actions.verified')),
            }
          : null
    : null;

  return (
    <>
      <Screen
        bottomBar={Boolean(primary)}
        refreshing={task.isRefetching}
        onRefresh={() => void task.refetch()}
      >
        {loadFailed(task) ? (
          <QueryError query={task} className="mt-6" />
        ) : task.isLoading || !x ? (
          <View className="gap-3">
            <Skeleton className="h-[312px] rounded-[40px]" />
            <Skeleton className="h-40 rounded-[30px]" />
          </View>
        ) : (
          <>
            <Rise>
              <DetailHero
                art="tileSage"
                onBack={() => nav.goBack()}
                trailing={
                  menuOptions.length > 0 ? (
                    <IconSquare
                      icon="more"
                      variant="linear"
                      diameter={46}
                      onPress={() => setMenu(true)}
                      accessibilityLabel={t('common:actions.more')}
                    />
                  ) : undefined
                }
                icon={{ name: 'tasks', motion: 'bob' }}
                pills={
                  <>
                    <TaskStatusPill status={x.status} />
                    {x.points > 0 ? (
                      <HeroPill label={t('tasks:points', { count: x.points })} />
                    ) : null}
                    {x.dueOn ? (
                      <HeroPill
                        dot={false}
                        label={t('tasks:due', { date: day(x.dueOn, 'short') })}
                      />
                    ) : null}
                  </>
                }
                title={x.title}
                meta={t('tasks:createdBy', { name: x.createdBy.displayName })}
              />
            </Rise>
            <Rise delay={80}>
              <Glass radius={30} style={styles.card}>
                {x.description ? (
                  <Text variant="body" style={styles.text}>
                    {x.description}
                  </Text>
                ) : null}
                {x.description ? <Divider className="my-4" /> : null}
                <View style={styles.who}>
                  <Avatar name={x.assignee?.displayName ?? '?'} size={40} />
                  <View className="flex-1 min-w-0">
                    <Text variant="title" numberOfLines={1}>
                      {x.assignee?.displayName ?? t('tasks:openForAll')}
                    </Text>
                    {x.submissionNote ? (
                      <Text variant="caption" tone="secondary">
                        {x.submissionNote}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Glass>
            </Rise>
            <PhotoSection className="mt-3.5" title={t('tasks:proofs')} photos={x.proofs} />
            {x.canVerify ? (
              <Button
                className="mt-3"
                variant="white"
                label={t('tasks:actions.sendBack')}
                onPress={() => {
                  setText('');
                  setSheet('sendBack');
                }}
              />
            ) : null}
            {x.canWithdraw ? (
              <Button
                className="mt-3"
                variant="ghost"
                label={t('tasks:actions.withdraw')}
                onPress={() => void run({ kind: 'withdraw' }, t('tasks:actions.withdrawn'))}
              />
            ) : null}
            <SectionHeader title={t('tasks:history')} />
            <Card tight className="gap-2">
              {x.events.map((e) => (
                <Row
                  key={`${e.kind}-${e.createdAt}`}
                  icon="clock"
                  title={t(`tasks:event.${e.kind}`)}
                  subtitle={[e.by.displayName, relative(e.createdAt), e.note]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
            </Card>
          </>
        )}
      </Screen>
      {primary ? (
        <BottomBar
          action={
            <Button
              label={primary.label}
              inline
              loading={action.isPending}
              onPress={primary.onPress}
            />
          }
        />
      ) : null}
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        options={menuOptions}
        onSelect={(k) => {
          if (k === 'edit') nav.navigate('TaskEditor', { taskId });
          else if (k === 'assign') setPick(true);
          else if (k === 'open')
            void run({ kind: 'assign', membershipId: null }, t('tasks:actions.assigned'));
          else setSheet('cancel');
        }}
      />
      <MemberPickerSheet
        visible={pick}
        onClose={() => setPick(false)}
        societyId={societyId}
        title={t('tasks:form.assignee')}
        value={x?.assignee?.membershipId}
        onSelect={(m) =>
          void run({ kind: 'assign', membershipId: m.membershipId }, t('tasks:actions.assigned'))
        }
      />
      <Sheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title={
          sheet === 'submit'
            ? t('tasks:actions.submitTitle')
            : sheet === 'sendBack'
              ? t('tasks:actions.sendBackTitle')
              : t('tasks:actions.cancel')
        }
        footer={
          <Button
            label={
              sheet === 'submit'
                ? t('tasks:actions.submit')
                : sheet === 'sendBack'
                  ? t('tasks:actions.sendBack')
                  : t('tasks:actions.cancel')
            }
            variant={sheet === 'cancel' ? 'danger' : 'ink'}
            loading={action.isPending}
            disabled={
              (sheet === 'sendBack' && text.trim().length < 2) ||
              (sheet === 'submit' && proofs.uploading)
            }
            onPress={() =>
              sheet === 'submit'
                ? void run(
                    { kind: 'submit', note: text.trim() || undefined, proofIds: proofs.ids },
                    t('tasks:actions.submitted'),
                  )
                : sheet === 'sendBack'
                  ? void run({ kind: 'sendBack', reason: text.trim() }, t('tasks:actions.sentBack'))
                  : void run({ kind: 'cancel' }, t('tasks:actions.cancelled'))
            }
          />
        }
      >
        {sheet === 'cancel' ? (
          <Text variant="body" tone="secondary">
            {x?.title ?? ''}
          </Text>
        ) : (
          <View className="gap-4">
            <TextArea
              white
              label={sheet === 'submit' ? t('tasks:actions.note') : t('tasks:actions.reason')}
              value={text}
              onChangeText={setText}
              maxLength={1000}
              minHeight={90}
            />
            {sheet === 'submit' ? (
              <PhotoField
                label={t('tasks:actions.proofs')}
                help={t('tasks:actions.proofsHelp')}
                picker={proofs}
                onGray
              />
            ) : null}
          </View>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, marginTop: 14 },
  text: { lineHeight: 24 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
