import {
  type Alert,
  type AlertType,
  AlertTypeSchema,
  type EmergencyContact,
  type EmergencyContactType,
  EmergencyContactTypeSchema,
} from '@movo/contracts';
import {
  Button,
  Card,
  Chip,
  CircleButton,
  EmptyState,
  HoldButton,
  Input,
  Row,
  Screen,
  SectionHeader,
  Sheet,
  Skeleton,
  StatusPill,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useSocietyId } from '../../core/tenant/hooks';
import { formatPhone } from '../../core/util/phone';
import { relative } from '../../core/util/time';
import {
  useAlerts,
  useDeleteContact,
  useEmergencyContacts,
  useRaiseAlert,
  useSaveContact,
} from './api';
import { ALERT_ICON, CONTACT_ICON } from './shared';

type ContactDraft = {
  id?: string;
  label: string;
  phone: string;
  type: EmergencyContactType;
  isPublicNumber: boolean;
};

export function EmergencyScreen() {
  const { t } = useTranslation(['emergency', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const canManageContacts = useCan('emergency.contacts.manage');
  const active = useAlerts(societyId, 'ACTIVE');
  const closed = useAlerts(societyId, 'CLOSED');
  const contacts = useEmergencyContacts(societyId);
  const raise = useRaiseAlert(societyId);
  const [type, setType] = useState<AlertType | null>(null);
  const [message, setMessage] = useState('');
  const [raiseError, setRaiseError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContactDraft | null>(null);

  const activeAlerts = active.data?.pages.flatMap((p) => p.items) ?? [];
  const pastAlerts = (closed.data?.pages.flatMap((p) => p.items) ?? []).slice(0, 5);
  const society = (contacts.data ?? []).filter((c) => !c.isPublicNumber);
  const publicNumbers = (contacts.data ?? []).filter((c) => c.isPublicNumber);

  const send = async () => {
    if (!type) return;
    setRaiseError(null);
    try {
      const alert = await raise.mutateAsync({ type, message: message.trim() || null });
      toast.show(t('emergency:sent'));
      setType(null);
      setMessage('');
      nav.navigate('AlertDetail', { alertId: alert.id });
    } catch (e) {
      setRaiseError(toMessage(e));
    }
  };

  return (
    <Screen
      refreshing={active.isRefetching || contacts.isRefetching}
      onRefresh={() => {
        void active.refetch();
        void closed.refetch();
        void contacts.refetch();
      }}
    >
      <TitleBar title={t('emergency:title')} onBack={() => nav.goBack()} />

      {activeAlerts.length > 0 ? (
        <>
          <SectionHeader title={t('emergency:activeAlerts')} />
          <Card tight className="gap-2 bg-danger-soft">
            {activeAlerts.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title={t('emergency:raise')} />
      <Card>
        <Text variant="label" tone="secondary">
          {t('emergency:raiseHelp')}
        </Text>
        <View className="mt-4 flex-row flex-wrap gap-2">
          {AlertTypeSchema.options.map((v) => (
            <Chip
              key={v}
              icon={ALERT_ICON[v]}
              label={t(`emergency:type.${v}`)}
              selected={type === v}
              onPress={() => setType(v)}
            />
          ))}
        </View>
        <Input
          white
          containerClassName="mt-4"
          label={t('emergency:message')}
          placeholder={t('emergency:messageHint')}
          value={message}
          onChangeText={setMessage}
          maxLength={280}
        />
        <HoldButton
          className="mt-4"
          label={t('emergency:hold')}
          holdingLabel={t('emergency:holding')}
          disabled={!type}
          loading={raise.isPending}
          onConfirm={() => void send()}
        />
        <Text variant="micro" tone="secondary" center className="mt-3 font-normal">
          {t('emergency:shareNote')}
        </Text>
        {raiseError ? (
          <Text variant="caption" tone="danger" center className="mt-2">
            {raiseError}
          </Text>
        ) : null}
      </Card>

      <SectionHeader
        title={t('emergency:societyContacts')}
        actionLabel={canManageContacts ? t('emergency:contactForm.add') : undefined}
        onAction={() => setDraft({ label: '', phone: '', type: 'SECURITY', isPublicNumber: false })}
      />
      {contacts.isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : society.length === 0 ? (
        <EmptyState
          icon="call"
          title={t('emergency:noContacts')}
          body={t('emergency:noContactsBody')}
        />
      ) : (
        <Card tight className="gap-2">
          {society.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              onEdit={canManageContacts ? () => setDraft({ ...c }) : undefined}
            />
          ))}
        </Card>
      )}

      {publicNumbers.length > 0 ? (
        <>
          <SectionHeader title={t('emergency:publicNumbers')} />
          <Card tight className="gap-2">
            {publicNumbers.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                onEdit={canManageContacts ? () => setDraft({ ...c }) : undefined}
              />
            ))}
          </Card>
        </>
      ) : null}

      {pastAlerts.length > 0 ? (
        <>
          <SectionHeader title={t('emergency:history')} />
          <Card tight className="gap-2">
            {pastAlerts.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </Card>
        </>
      ) : null}

      <ContactSheet draft={draft} onChange={setDraft} societyId={societyId} />
    </Screen>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const { t } = useTranslation('emergency');
  const nav = useNav();
  const place = alert.flat ? formatFlat(alert.flat) : t('societyPlace');
  return (
    <Row
      icon={ALERT_ICON[alert.type]}
      title={t('alert.title', { type: t(`type.${alert.type}`) })}
      subtitle={[place, alert.raisedBy?.displayName, relative(alert.createdAt)]
        .filter(Boolean)
        .join(' · ')}
      trailing={
        <StatusPill
          label={t(`status.${alert.status}`)}
          tone={alert.status === 'ACTIVE' ? 'danger' : 'neutral'}
          dot={alert.status === 'ACTIVE'}
        />
      }
      onPress={() => nav.navigate('AlertDetail', { alertId: alert.id })}
    />
  );
}

export function ContactRow({
  contact,
  onEdit,
}: {
  contact: EmergencyContact;
  onEdit?: (() => void) | undefined;
}) {
  const { t } = useTranslation(['emergency', 'common']);
  return (
    <Row
      icon={CONTACT_ICON[contact.type]}
      title={contact.label}
      subtitle={`${formatPhone(contact.phone)} · ${t(`emergency:contactType.${contact.type}`)}`}
      onPress={onEdit}
      trailing={
        <CircleButton
          icon="call"
          accessibilityLabel={`${t('common:actions.call')} ${contact.label}`}
          onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
        />
      }
    />
  );
}

function ContactSheet({
  draft,
  onChange,
  societyId,
}: {
  draft: ContactDraft | null;
  onChange: (d: ContactDraft | null) => void;
  societyId: string;
}) {
  const { t } = useTranslation(['emergency', 'common']);
  const toast = useToast();
  const toMessage = useErrorMessage();
  const save = useSaveContact(societyId);
  const remove = useDeleteContact(societyId);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onChange(null);
  };
  const submit = async () => {
    if (!draft) return;
    if (draft.label.trim().length < 2 || draft.phone.trim().length < 3) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      await save.mutateAsync({
        ...(draft.id ? { contactId: draft.id } : {}),
        body: {
          label: draft.label.trim(),
          phone: draft.phone.trim(),
          type: draft.type,
          isPublicNumber: draft.isPublicNumber,
        },
      });
      toast.show(t('emergency:contactForm.saved'));
      close();
    } catch (e) {
      setError(toMessage(e));
    }
  };
  const del = async () => {
    if (!draft?.id) return;
    try {
      await remove.mutateAsync(draft.id);
      toast.show(t('emergency:contactForm.deleted'));
      close();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <Sheet
      visible={Boolean(draft)}
      onClose={close}
      title={draft?.id ? t('emergency:contactForm.edit') : t('emergency:contactForm.add')}
      footer={
        <View className="gap-2">
          <Button
            label={t('common:actions.save')}
            onPress={() => void submit()}
            loading={save.isPending}
          />
          {draft?.id ? (
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
      {draft ? (
        <View className="gap-3">
          <Input
            white
            label={t('emergency:contactForm.label')}
            value={draft.label}
            onChangeText={(label) => onChange({ ...draft, label })}
            maxLength={60}
          />
          <Input
            white
            label={t('emergency:contactForm.phone')}
            value={draft.phone}
            onChangeText={(phone) => onChange({ ...draft, phone })}
            keyboardType="phone-pad"
            maxLength={20}
          />
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('emergency:contactForm.type')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {EmergencyContactTypeSchema.options.map((v) => (
                <Chip
                  key={v}
                  label={t(`emergency:contactType.${v}`)}
                  selected={draft.type === v}
                  onPress={() => onChange({ ...draft, type: v })}
                />
              ))}
            </View>
          </View>
          <View className="flex-row items-center justify-between rounded-md bg-card-nested px-[18px] py-3">
            <Text variant="body" className="flex-1 pr-3">
              {t('emergency:contactForm.isPublic')}
            </Text>
            <Toggle
              value={draft.isPublicNumber}
              onValueChange={(isPublicNumber) => onChange({ ...draft, isPublicNumber })}
            />
          </View>
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}
