import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, PasswordInput, Text } from '@movo/design-system';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { z } from 'zod';
import { useErrorMessage } from '../../core/api/use-error-message';
import { signIn } from '../../core/auth/auth';
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
    <AuthShell title={t('auth:welcomeTitle')} subtitle={t('auth:welcomeBody')}>
      <View className="gap-3">
        <Controller
          control={form.control}
          name="identifier"
          render={({ field, fieldState }) => (
            <Input
              label={t('auth:identifier')}
              placeholder={t('auth:identifierHint')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <PasswordInput
              label={t('auth:password')}
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
          className="mt-2"
        />
      </View>
      <View className="mt-8 items-center gap-3">
        <Text variant="caption" tone="secondary">
          {t('auth:noAccount')}
        </Text>
        <Button
          label={t('auth:register')}
          variant="gray"
          onPress={() => nav.navigate('Register')}
        />
        <Text variant="micro" tone="tertiary" center className="mt-2 font-normal">
          {t('auth:termsNote')}
        </Text>
      </View>
    </AuthShell>
  );
}
