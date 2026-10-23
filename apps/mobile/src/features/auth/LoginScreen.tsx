import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, PasswordInput, Press, Text, WavingHand } from '@movo/design-system';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { useErrorMessage } from '../../core/api/use-error-message';
import { signIn } from '../../core/auth/auth';
import { PRIVACY_POLICY_URL } from '../../core/env';
import { useNav } from '../../core/navigation/types';
import { AuthShell } from './AuthShell';

type Mode = 'phone' | 'email';
const COUNTRY = '+91';

/** Soft Glow log in, laid out like docs/design/soft-glow/source/Login.dc.html. */
export function LoginScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const nav = useNav();
  const toMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('phone');
  const schema = useMemo(
    () =>
      z.object({
        identifier: z.string().trim().min(3, t('common:validation.invalidIdentifier')),
        password: z.string().min(8, t('common:validation.passwordMin')),
      }),
    [t],
  );
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '' },
  });
  const busy = form.formState.isSubmitting;

  // The server takes a 10-digit Indian number or an email in the same field.
  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.identifier, values.password);
    } catch (e) {
      setError(toMessage(e));
    }
  });

  const pick = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    form.setValue('identifier', '');
    form.clearErrors('identifier');
  };

  return (
    <AuthShell
      title={t('auth:glow.loginA')}
      titleBold={t('auth:glow.loginB')}
      subtitle={t('auth:glow.loginBody')}
      art={<WavingHand />}
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      action={
        <Button
          size="xl"
          arrow
          sheen
          label={busy ? t('auth:glow.loggingIn') : t('auth:login')}
          onPress={() => void submit()}
          loading={busy}
        />
      }
      footer={
        <>
          <View style={styles.newRow}>
            <Text variant="body" tone="secondary" style={styles.small}>
              {t('auth:noAccount')}
            </Text>
            <Pressable onPress={() => nav.navigate('Register')} hitSlop={8}>
              <Text variant="body" className="font-semibold" style={styles.small}>
                {t('auth:register')}
              </Text>
            </Pressable>
          </View>
          <Text
            variant="micro"
            tone="tertiary"
            center
            className="font-normal"
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          >
            {t('auth:termsNote')}
          </Text>
        </>
      }
    >
      <View style={styles.modes} accessibilityRole="radiogroup">
        {(['phone', 'email'] as const).map((m) => (
          <Press
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === m }}
            onPress={() => pick(m)}
            scaleTo={0.97}
            style={[styles.mode, mode === m && styles.modeOn]}
          >
            <Text variant="bodyMedium">
              {m === 'phone' ? t('auth:glow.byPhone') : t('auth:glow.byEmail')}
            </Text>
          </Press>
        ))}
      </View>
      <Controller
        control={form.control}
        name="identifier"
        render={({ field, fieldState }) => (
          <Input
            label={mode === 'phone' ? t('auth:glow.mobile') : t('auth:glow.email')}
            placeholder={mode === 'phone' ? t('auth:glow.phoneHint') : t('auth:glow.emailHint')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={mode === 'phone' ? 'phone-pad' : 'email-address'}
            textContentType={mode === 'phone' ? 'telephoneNumber' : 'username'}
            autoComplete={mode === 'phone' ? 'tel' : 'username'}
            returnKeyType="next"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            prefix={mode === 'phone' ? COUNTRY : undefined}
          />
        )}
      />
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordInput
            label={t('auth:password')}
            placeholder={t('auth:glow.passwordHint')}
            textContentType="password"
            autoComplete="current-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            onSubmitEditing={() => void submit()}
            returnKeyType="go"
          />
        )}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
      <Pressable
        onPress={() => nav.navigate('ForgotPassword')}
        style={styles.forgot}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Text variant="caption" className="font-medium">
          {t('auth:forgotPassword')}
        </Text>
      </Pressable>
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
  mode: { flex: 1, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: '#FFFFFF', boxShadow: '0 4px 12px rgba(70,40,70,0.1)' },
  forgot: { alignSelf: 'flex-end', paddingHorizontal: 6, paddingVertical: 2 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { fontSize: 14 },
});
