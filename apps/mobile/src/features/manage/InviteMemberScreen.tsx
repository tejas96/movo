import { type Invitation, type OccupancyRelation, OccupancyRelationSchema } from '@movo/contracts';
import {
  Button,
  Input,
  OptionSheet,
  Screen,
  SelectField,
  Sheet,
  Text,
  TitleBar,
} from '@movo/design-system';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId, useTenant } from '../../core/tenant/hooks';
import { normalizePhone } from '../../core/util/phone';
import { useRoles } from '../directory/api';
import { useCreateInvitation, useFlats } from './api';

const NO_FLAT = '__none__';

export function InviteMemberScreen() {
  const { t } = useTranslation(['manage', 'common']);
  const nav = useNav();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const flats = useFlats(societyId);
  const roles = useRoles(societyId);
  const create = useCreateInvitation(societyId);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [flatId, setFlatId] = useState<string>(NO_FLAT);
  const [roleId, setRoleId] = useState<string | undefined>(undefined);
  const [relation, setRelation] = useState<OccupancyRelation>('OWNER');
  const [open, setOpen] = useState<'flat' | 'role' | 'relation' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Invitation | null>(null);

  const flatOptions = useMemo(
    () => [
      { value: NO_FLAT, label: t('manage:invite.noFlat') },
      ...(flats.data ?? []).map((f) => ({
        value: f.id,
        label: f.buildingName ? `${f.buildingName}-${f.number}` : f.number,
        hint: f.occupants.map((o) => o.displayName).join(', ') || undefined,
      })),
    ],
    [flats.data, t],
  );
  const roleOptions = (roles.data ?? []).map((r) => ({ value: r.id, label: r.name }));
  const relationOptions = OccupancyRelationSchema.options.map((r) => ({
    value: r,
    label: t(`common:relation.${r}`),
  }));
  const residentRole = roles.data?.find((r) => r.key === 'resident');
  const effectiveRoleId = roleId ?? residentRole?.id;

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError(t('common:validation.nameMin'));
    try {
      const inv = await create.mutateAsync({
        inviteeName: name.trim(),
        phone: phone.trim() ? normalizePhone(phone) : undefined,
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        flatId: flatId === NO_FLAT ? null : flatId,
        roleId: effectiveRoleId,
        relation,
        expiresInDays: 30,
      });
      setCreated(inv);
    } catch (e) {
      setError(toMessage(e));
    }
  };

  const share = () => {
    if (!created) return;
    void Share.share({
      message: t('manage:invite.shareText', { society: tenant.society.name, code: created.code }),
    });
  };

  return (
    <Screen>
      <TitleBar title={t('manage:invite.title')} onBack={() => nav.goBack()} />
      <View className="mt-6 gap-3">
        <Input label={t('manage:invite.name')} value={name} onChangeText={setName} />
        <Input
          label={t('manage:invite.phone')}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Input
          label={t('manage:invite.email')}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <SelectField
          label={t('manage:invite.flat')}
          value={flatOptions.find((o) => o.value === flatId)?.label}
          onPress={() => setOpen('flat')}
        />
        <SelectField
          label={t('manage:invite.role')}
          value={roleOptions.find((o) => o.value === effectiveRoleId)?.label}
          onPress={() => setOpen('role')}
        />
        <SelectField
          label={t('manage:invite.relation')}
          value={t(`common:relation.${relation}`)}
          onPress={() => setOpen('relation')}
        />
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
        <Button
          label={t('manage:invite.create')}
          onPress={() => void submit()}
          loading={create.isPending}
          className="mt-2"
        />
      </View>
      <OptionSheet
        visible={open === 'flat'}
        onClose={() => setOpen(null)}
        title={t('manage:invite.flat')}
        options={flatOptions}
        value={flatId}
        onSelect={setFlatId}
      />
      <OptionSheet
        visible={open === 'role'}
        onClose={() => setOpen(null)}
        title={t('manage:invite.role')}
        options={roleOptions}
        value={effectiveRoleId}
        onSelect={setRoleId}
      />
      <OptionSheet
        visible={open === 'relation'}
        onClose={() => setOpen(null)}
        title={t('manage:invite.relation')}
        options={relationOptions}
        value={relation}
        onSelect={setRelation}
      />
      <Sheet
        visible={Boolean(created)}
        onClose={() => {
          setCreated(null);
          nav.goBack();
        }}
        title={t('manage:invite.created')}
        footer={<Button label={t('common:actions.share')} icon="share" onPress={share} />}
      >
        <Text variant="body" tone="secondary">
          {created
            ? t('manage:invite.shareText', { society: tenant.society.name, code: created.code })
            : ''}
        </Text>
        <View className="mt-4 items-center rounded-md bg-card-nested py-5">
          <Text variant="display" className="tracking-[6px]">
            {created?.code}
          </Text>
        </View>
      </Sheet>
    </Screen>
  );
}
