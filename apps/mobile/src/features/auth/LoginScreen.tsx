import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, PasswordInput, Text, WavingHand } from '@movo/design-system';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { useErrorMessage } from '../../core/api/use-error-message';
import { signIn } from '../../core/auth/auth';
import { PRIVACY_POLICY_URL } from '../../core/env';
import { useNav } from '../../core/navigation/types';
import { AuthShell } from '../../core/ui/AuthShell';

const COUNTRY = '+91';
/** Only digits and spaces so far: show +91 in front so it reads as a phone number. */
const looksLikePhone = (v: string) => /^\d[\d ]*$/.test(v);

/** Soft Glow log in, laid out like docs/design/soft-glow/source/Login.dc.html. */
export function LoginScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const nav = useNav();
  const toMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
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
      <Controller
        control={form.control}
        name="identifier"
        render={({ field, fieldState }) => (
          <Input
            label={t('auth:identifier')}
            placeholder={t('auth:glow.identifierHint')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
            returnKeyType="next"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            prefix={looksLikePhone(field.value) ? COUNTRY : undefined}
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
  forgot: { alignSelf: 'flex-end', paddingHorizontal: 6, paddingVertical: 2 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { fontSize: 14 },
});
