import {
  Button,
  Card,
  IconSquare,
  Input,
  Row,
  Screen,
  Segmented,
  StatusPill,
  Text,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { signOut } from '../../core/auth/auth';
import { useNav } from '../../core/navigation/types';
import { useMeContext } from '../../core/tenant/hooks';
import { useAcceptInvite, useJoinPreview } from './api';

type Mode = 'invite' | 'society';

/** First screen after sign-up: enter an invite code, or a society code to ask for access. */
export function JoinScreen() {
  const { t } = useTranslation(['onboarding', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const ctx = useMeContext();
  const [mode, setMode] = useState<Mode>('invite');
  const [code, setCode] = useState('');
  const [lookup, setLookup] = useState('');
  const accept = useAcceptInvite();
  const preview = useJoinPreview(lookup, lookup.length >= 4);
  const pending = ctx.data?.pendingJoinRequests ?? [];
  const hasSociety = Boolean(ctx.data?.memberships.some((m) => m.status === 'ACTIVE'));

  const submit = async () => {
    const value = code.trim().toUpperCase();
    if (value.length < 4) return;
    if (mode === 'invite') {
      try {
        const result = await accept.mutateAsync(value);
        toast.show(t('onboarding:joined', { society: result.society.name }));
        if (hasSociety) nav.goBack();
      } catch (e) {
        toast.show(toMessage(e), 'error');
      }
    } else {
      setLookup(value);
    }
  };

  if (mode === 'society' && lookup && preview.data) {
    nav.navigate('PickFlat', { joinCode: lookup });
    setLookup('');
  }
  if (mode === 'society' && lookup && preview.isError) {
    toast.show(toMessage(preview.error), 'error');
    setLookup('');
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View className="h-14 w-14 items-center justify-center rounded-md bg-ink">
          <Text variant="h2" tone="inverse">
            M
          </Text>
        </View>
        {hasSociety ? (
          <IconSquare icon="back" variant="linear" onPress={() => nav.goBack()} />
        ) : (
          <IconSquare
            icon="logout"
            variant="linear"
            onPress={() => void signOut()}
            accessibilityLabel={t('common:actions.signOut')}
          />
        )}
      </View>
      <Text variant="h1" className="mt-6">
        {t('onboarding:title')}
      </Text>
      <Text variant="body" tone="secondary" className="mt-1">
        {t('onboarding:body')}
      </Text>

      {pending.length > 0 ? (
        <Card tight className="mt-6">
          {pending.map((p) => (
            <Row
              key={p.id}
              icon="clock"
              title={p.society.name}
              subtitle={t('onboarding:pendingBody', {
                society: p.society.name,
                flat: p.buildingName ? `${p.buildingName}-${p.flatNumber}` : p.flatNumber,
              })}
              trailing={<StatusPill label={t(`common:status.${p.status}`)} tone="warning" />}
              onPress={() => nav.navigate('Pending')}
            />
          ))}
        </Card>
      ) : null}

      <Segmented
        className="mt-6"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'invite', label: t('onboarding:inviteCode') },
          { value: 'society', label: t('onboarding:societyCode') },
        ]}
      />
      <View className="mt-4 gap-3">
        <Input
          label={mode === 'invite' ? t('onboarding:inviteCode') : t('onboarding:societyCode')}
          helper={mode === 'invite' ? t('onboarding:inviteHelp') : undefined}
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          onSubmitEditing={() => void submit()}
        />
        <Button
          label={mode === 'invite' ? t('common:actions.continue') : t('onboarding:findSociety')}
          onPress={() => void submit()}
          loading={accept.isPending || (preview.isFetching && Boolean(lookup))}
        />
      </View>
    </Screen>
  );
}
