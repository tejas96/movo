import {
  ArtFill,
  Building,
  Button,
  Icon,
  IconSquare,
  Press,
  Row,
  StatusPill,
  Text,
  theme,
  useToast,
} from '@movo/design-system';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useErrorMessage } from '../../core/api/use-error-message';
import { signOut } from '../../core/auth/auth';
import { useNav } from '../../core/navigation/types';
import { useMeContext } from '../../core/tenant/hooks';
import { AuthShell } from '../../core/ui/AuthShell';
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

  const modes: Mode[] = ['invite', 'society'];

  return (
    <AuthShell
      title={t(mode === 'invite' ? 'onboarding:glow.inviteA' : 'onboarding:glow.societyA')}
      titleBold={t(mode === 'invite' ? 'onboarding:glow.inviteB' : 'onboarding:glow.societyB')}
      subtitle={t(mode === 'invite' ? 'onboarding:inviteBody' : 'onboarding:societyBody')}
      art={<Building width={96} />}
      onBack={hasSociety ? () => nav.goBack() : undefined}
      leading={
        hasSociety ? undefined : (
          <IconSquare
            icon="logout"
            variant="linear"
            diameter={46}
            onPress={() => void signOut()}
            accessibilityLabel={t('common:actions.signOut')}
          />
        )
      }
      action={
        mode === 'invite' ? (
          <Button
            size="xl"
            arrow
            label={t('onboarding:join')}
            onPress={() => void joinWithInvite(code)}
            disabled={!complete}
            loading={accept.isPending}
          />
        ) : (
          <Button
            size="xl"
            arrow
            label={t('onboarding:pickFlatCta')}
            onPress={() => nav.navigate('PickFlat', { joinCode: code })}
            disabled={!found}
            loading={complete && preview.isFetching}
          />
        )
      }
      footer={
        <Text variant="caption" tone="secondary" center>
          {t(mode === 'invite' ? 'onboarding:noInviteCode' : 'onboarding:noSocietyCode')}
        </Text>
      }
    >
      <View style={styles.modes} accessibilityRole="radiogroup">
        {modes.map((m) => (
          <Press
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === m }}
            onPress={() => switchMode(m)}
            scaleTo={0.97}
            style={[styles.mode, mode === m && styles.modeOn]}
          >
            <Text variant="bodyMedium" numberOfLines={1}>
              {m === 'invite' ? t('onboarding:inviteCode') : t('onboarding:societyCode')}
            </Text>
          </Press>
        ))}
      </View>

      <View>
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
          <View style={styles.found}>
            <ArtFill art="home" radius={18} fade={0} blur={14} style={styles.thumb}>
              <View style={styles.thumbIcon}>
                <Icon name="building" size={24} color={theme.color.icon.primary} />
              </View>
            </ArtFill>
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

      {pending.length > 0 ? (
        <View style={styles.pending}>
          {pending.map((p) => (
            <Row
              key={p.id}
              onGray
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
        </View>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  modes: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  mode: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeOn: { backgroundColor: '#FFFFFF', boxShadow: '0 4px 12px rgba(70,40,70,0.1)' },
  found: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  thumb: { width: 64, height: 64 },
  thumbIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pending: { marginHorizontal: -8 },
});
