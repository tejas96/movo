import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, PasswordInput, Text } from '@movo/design-system';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';
import { z } from 'zod';
import { useErrorMessage } from '../../core/api/use-error-message';
import { signIn } from '../../core/auth/auth';
import { PRIVACY_POLICY_URL } from '../../core/env';
import { useNav } from '../../core/navigation/types';
import { AuthShell } from './AuthShell';

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
      title={t('auth:welcomeBack')}
      subtitle={t('auth:welcomeBackBody')}
      footer={
        <>
          <View className="flex-row items-center gap-1.5">
            <Text variant="caption" tone="secondary">
              {t('auth:noAccount')}
            </Text>
            <Pressable onPress={() => nav.navigate('Register')} hitSlop={8}>
              <Text variant="caption" className="font-semibold">
                {t('auth:register')}
              </Text>
            </Pressable>
          </View>
          <Text
            variant="micro"
            tone="tertiary"
            center
            className="mt-2 font-normal"
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          >
            {t('auth:termsNote')}
          </Text>
        </>
      }
    >
      <View className="gap-3">
        <Controller
          control={form.control}
          name="identifier"
          render={({ field, fieldState }) => (
            <Input
              icon="mail"
              placeholder={t('auth:identifier')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              helper={fieldState.error ? undefined : t('auth:identifierHint')}
            />
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <PasswordInput
              icon="lock"
              placeholder={t('auth:password')}
              textContentType="password"
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
        <Pressable onPress={() => nav.navigate('ForgotPassword')} className="self-end" hitSlop={8}>
          <Text variant="caption" tone="secondary" className="font-medium">
            {t('auth:forgotPassword')}
          </Text>
        </Pressable>
        <Button
          label={t('auth:login')}
          onPress={() => void submit()}
          loading={form.formState.isSubmitting}
          className="mt-1"
        />
      </View>
    </AuthShell>
  );
}
