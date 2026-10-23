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
  Chip,
  Glass,
  Icon,
  IconSquare,
  Input,
  Press,
  Rise,
  Row,
  Screen,
  SectionLabel,
  Sheet,
  Skeleton,
  Text,
  Toggle,
  theme,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { StatusPill } from '../../core/ui/StatusPill';
import { relative } from '../../core/util/date';
import { formatPhone } from '../../core/util/phone';
import {
  useAlerts,
  useDeleteContact,
  useEmergencyContacts,
  useRaiseAlert,
  useSaveContact,
} from './api';
import { HoldOrb } from './HoldOrb';
import { ALERT_ICON, ALERT_STATUS_TONE, CONTACT_ICON } from './shared';

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

  const hint = type ? t('emergency:shareNote') : t('emergency:raiseHelp');

  return (
    <Screen
      glow="alert"
      refreshing={active.isRefetching || contacts.isRefetching}
      onRefresh={() => {
        void active.refetch();
        void closed.refetch();
        void contacts.refetch();
      }}
    >
      <View style={styles.page}>
        <Rise>
          <View style={styles.titleRow}>
            <IconSquare
              icon="back"
              variant="linear"
              diameter={46}
              onPress={() => nav.goBack()}
              accessibilityLabel={t('common:actions.back')}
            />
            <Text variant="h1" className="flex-1" numberOfLines={1}>
              {t('emergency:title')}
            </Text>
          </View>
        </Rise>

        {loadFailed(active) ? (
          <QueryError query={active} />
        ) : activeAlerts.length > 0 ? (
          <Rise delay={40}>
            <Glass radius={28} style={styles.list}>
              <SectionLabel>{t('emergency:activeAlerts')}</SectionLabel>
              {activeAlerts.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </Glass>
          </Rise>
        ) : null}

        {/* What is happening: six types in a 3 x 2 grid. */}
        <Rise delay={60}>
          <Glass radius={30} style={styles.types}>
            <Text variant="body" tone="secondary" style={styles.what}>
              {t('emergency:glow.what')}
            </Text>
            <View style={styles.grid} accessibilityRole="radiogroup">
              {AlertTypeSchema.options.map((v) => {
                const on = type === v;
                return (
                  <Press
                    key={v}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => setType(v)}
                    scaleTo={0.95}
                    style={[styles.type, on && styles.typeOn]}
                  >
                    <Icon
                      name={ALERT_ICON[v]}
                      size={22}
                      color={on ? theme.color.status.danger.fg : theme.color.icon.primary}
                    />
                    <Text variant="label" className="font-medium" numberOfLines={1}>
                      {t(`emergency:type.${v}`)}
                    </Text>
                  </Press>
                );
              })}
            </View>
            {type ? (
              <Input
                white
                containerClassName="mt-3"
                label={t('emergency:message')}
                placeholder={t('emergency:messageHint')}
                value={message}
                onChangeText={setMessage}
                maxLength={280}
              />
            ) : null}
          </Glass>
        </Rise>

        <Rise delay={140}>
          <HoldOrb
            disabled={!type}
            loading={raise.isPending}
            onConfirm={() => void send()}
            hint={hint}
          />
          {raiseError ? (
            <Text variant="caption" tone="danger" center className="mt-2">
              {raiseError}
            </Text>
          ) : null}
        </Rise>

        <Rise delay={220}>
          {contacts.isLoading ? (
            <Skeleton className="h-40 rounded-[28px]" />
          ) : loadFailed(contacts) ? (
            <QueryError query={contacts} />
          ) : (
            <Glass radius={28} style={styles.list}>
              <View style={styles.labelRow}>
                <SectionLabel className="flex-1">{t('emergency:contacts')}</SectionLabel>
                {canManageContacts ? (
                  <Press
                    accessibilityRole="button"
                    onPress={() =>
                      setDraft({ label: '', phone: '', type: 'SECURITY', isPublicNumber: false })
                    }
                    hitSlop={8}
                    style={styles.add}
                  >
                    <Text variant="label" tone="accent" className="font-medium">
                      {t('emergency:contactForm.add')}
                    </Text>
                  </Press>
                ) : null}
              </View>
              {publicNumbers.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  onGray
                  onEdit={c.canEdit ? () => setDraft({ ...c }) : undefined}
                />
              ))}
              {society.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  onGray
                  onEdit={c.canEdit ? () => setDraft({ ...c }) : undefined}
                />
              ))}
              {society.length === 0 && publicNumbers.length === 0 ? (
                <View style={styles.none}>
                  <Text variant="bodyMedium">{t('emergency:noContacts')}</Text>
                  <Text variant="caption" tone="secondary">
                    {t('emergency:noContactsBody')}
                  </Text>
                </View>
              ) : null}
            </Glass>
          )}
        </Rise>

        {pastAlerts.length > 0 ? (
          <Rise delay={280}>
            <Glass radius={28} style={styles.list}>
              <SectionLabel>{t('emergency:history')}</SectionLabel>
              {pastAlerts.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </Glass>
          </Rise>
        ) : null}
      </View>

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
      onGray
      icon={ALERT_ICON[alert.type]}
      title={t('alert.title', { type: t(`type.${alert.type}`) })}
      subtitle={[place, alert.raisedBy?.displayName, relative(alert.createdAt)]
        .filter(Boolean)
        .join(' · ')}
      trailing={
        <StatusPill
          value={alert.status}
          tones={ALERT_STATUS_TONE}
          labels="emergency:status"
          dot={alert.status === 'ACTIVE'}
        />
      }
      onPress={() => nav.navigate('AlertDetail', { alertId: alert.id })}
    />
  );
}

/**
 * A contact line. Public numbers (112, 101) show the number on a soft red disc and a red call
 * button; society contacts show their icon on a soft orange disc and a white call button.
 */
export function ContactRow({
  contact,
  onEdit,
  onGray,
}: {
  contact: EmergencyContact;
  onEdit?: (() => void) | undefined;
  onGray?: boolean;
}) {
  const { t } = useTranslation(['emergency', 'common']);
  const pub = contact.isPublicNumber;
  const short = pub && contact.phone.replace(/\D/g, '').length <= 4;
  return (
    <Row
      onGray={onGray}
      leading={
        <View style={[styles.disc, pub ? styles.discRed : styles.discOrange]}>
          {short ? (
            <Text variant="bodyMedium" className="font-semibold" style={styles.discNumber}>
              {contact.phone}
            </Text>
          ) : (
            <Icon name={CONTACT_ICON[contact.type]} size={20} color={pub ? '#A82626' : '#B5501F'} />
          )}
        </View>
      }
      title={contact.label}
      subtitle={`${formatPhone(contact.phone)} · ${t(`emergency:contactType.${contact.type}`)}`}
      onPress={onEdit}
      trailing={
        <Press
          accessibilityRole="button"
          accessibilityLabel={`${t('common:actions.call')} ${contact.label}`}
          onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
          scaleTo={0.92}
          style={[styles.call, pub ? styles.callRed : styles.callWhite]}
        >
          <Icon
            name="call"
            variant="linear"
            size={17}
            color={pub ? '#FFFFFF' : theme.color.accent.fg}
          />
        </Press>
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

const styles = StyleSheet.create({
  page: { gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  list: { padding: 8 },
  types: { padding: 14 },
  what: { marginTop: 2, marginHorizontal: 4, marginBottom: 12, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  type: {
    width: '31.5%',
    flexGrow: 1,
    height: 74,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  typeOn: { backgroundColor: '#FFFFFF', boxShadow: '0 6px 16px rgba(214,59,59,0.18)' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  add: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  none: { paddingHorizontal: 12, paddingBottom: 12, gap: 2 },
  disc: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  discRed: { backgroundColor: '#FBE2E2' },
  discOrange: { backgroundColor: theme.color.accent.bg },
  discNumber: { color: '#A82626', fontSize: 14 },
  call: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  callRed: { backgroundColor: '#D63B3B' },
  callWhite: { backgroundColor: '#FFFFFF', boxShadow: '0 4px 12px rgba(70,40,70,0.06)' },
});
