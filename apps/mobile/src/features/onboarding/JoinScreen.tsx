import {
  Button,
  Card,
  IconSquare,
  photos,
  Row,
  Screen,
  Segmented,
  StatusPill,
  Text,
  useToast,
} from '@movo/design-system';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useErrorMessage } from '../../core/api/use-error-message';
import { signOut } from '../../core/auth/auth';
import { useNav } from '../../core/navigation/types';
import { useMeContext } from '../../core/tenant/hooks';
import { useAcceptInvite, useJoinPreview } from './api';
import { CodeInput } from './CodeInput';

type Mode = 'invite' | 'society';
/** Invite codes are 8 readable characters, a society's join code is 6. Same as the server. */
const LENGTH: Record<Mode, number> = { invite: 8, society: 6 };

/** First screen after sign-up: type an invite code, or a society code to ask for access. */
export function JoinScreen() {
  const { t } = useTranslation(['onboarding', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const ctx = useMeContext();
  const [mode, setMode] = useState<Mode>('invite');
  const [code, setCode] = useState('');
  const [shake, setShake] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const accept = useAcceptInvite();
  const complete = code.length === LENGTH[mode];
  const preview = useJoinPreview(code, mode === 'society' && complete);
  const pending = ctx.data?.pendingJoinRequests ?? [];
  const hasSociety = Boolean(ctx.data?.memberships.some((m) => m.status === 'ACTIVE'));
  const found = mode === 'society' && complete ? preview.data : undefined;

  const switchMode = (next: Mode) => {
    setMode(next);
    setCode('');
    setError(null);
  };

  const reject = useCallback((message: string) => {
    setError(message);
    setShake((n) => n + 1);
  }, []);

  // A society code that does not match: shake, explain, let them retype.
  useEffect(() => {
    if (mode === 'society' && complete && preview.isError) reject(toMessage(preview.error));
  }, [mode, complete, preview.isError, preview.error, toMessage, reject]);

  // Takes the code as an argument: the last typed box submits before the state has updated.
  const joinWithInvite = async (value: string) => {
    if (value.length !== LENGTH.invite || accept.isPending) return;
    setError(null);
    try {
      const result = await accept.mutateAsync(value);
      toast.show(t('onboarding:joined', { society: result.society.name }));
      if (hasSociety) nav.goBack();
    } catch (e) {
      reject(toMessage(e));
    }
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
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
        {t(mode === 'invite' ? 'onboarding:inviteTitle' : 'onboarding:societyTitle')}
      </Text>
      <Text variant="body" tone="secondary" className="mt-1">
        {t(mode === 'invite' ? 'onboarding:inviteBody' : 'onboarding:societyBody')}
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
        onChange={switchMode}
        options={[
          { value: 'invite', label: t('onboarding:inviteCode') },
          { value: 'society', label: t('onboarding:societyCode') },
        ]}
      />

      <View className="mt-5">
        <CodeInput
          key={mode}
          length={LENGTH[mode]}
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          onComplete={mode === 'invite' ? (v) => void joinWithInvite(v) : undefined}
          shake={shake}
          autoFocus
          disabled={accept.isPending}
        />
        {error ? (
          <Text variant="caption" tone="danger" className="mt-3">
            {error}
          </Text>
        ) : null}
      </View>

      {found ? (
        <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOut.duration(150)}>
          <View className="mt-5 flex-row items-center gap-3 rounded-lg bg-card p-2.5">
            <View style={styles.thumb}>
              <Image source={photos.society} resizeMode="cover" style={styles.photo} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="title" numberOfLines={1}>
                {found.society.name}
              </Text>
              <Text variant="label" tone="secondary" numberOfLines={1}>
                {[found.society.city, t('onboarding:flatsCount', { count: found.flats.length })]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <View className="mt-1 self-start">
                <StatusPill label={t('onboarding:codeFound')} tone="success" />
              </View>
            </View>
          </View>
        </Animated.View>
      ) : null}

      <View className="mt-6 gap-3">
        {mode === 'invite' ? (
          <Button
            label={t('onboarding:join')}
            onPress={() => void joinWithInvite(code)}
            disabled={!complete}
            loading={accept.isPending}
          />
        ) : (
          <Button
            label={t('onboarding:pickFlatCta')}
            onPress={() => nav.navigate('PickFlat', { joinCode: code })}
            disabled={!found}
            loading={complete && preview.isFetching}
          />
        )}
        <Text variant="micro" tone="tertiary" center className="font-normal">
          {t(mode === 'invite' ? 'onboarding:noInviteCode' : 'onboarding:noSocietyCode')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 64, height: 64, borderRadius: 18, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
});
