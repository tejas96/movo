import { zodResolver } from '@hookform/resolvers/zod';
import { LOCALES, type Locale } from '@movo/contracts';
import { Button, Chip, Input, PasswordInput, Text } from '@movo/design-system';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { z } from 'zod';
import { useErrorMessage } from '../../core/api/use-error-message';
import { signUp } from '../../core/auth/auth';
import { PRIVACY_POLICY_URL } from '../../core/env';
import { currentLocale, setAppLocale } from '../../core/i18n';
import { useNav } from '../../core/navigation/types';
import { AuthShell } from './AuthShell';

export function RegisterScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const nav = useNav();
  const toMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(currentLocale());
  const schema = useMemo(
    () =>
      z
        .object({
          displayName: z.string().trim().min(2, t('common:validation.nameMin')),
          identifier: z.string().trim().min(3, t('common:validation.invalidIdentifier')),
          password: z.string().min(8, t('common:validation.passwordMin')),
          confirm: z.string(),
        })
        .refine((v) => v.password === v.confirm, {
          path: ['confirm'],
          message: t('common:validation.passwordMismatch'),
        }),
    [t],
  );
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', identifier: '', password: '', confirm: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await signUp({
        identifier: values.identifier,
        password: values.password,
        displayName: values.displayName,
        locale,
      });
    } catch (e) {
      setError(toMessage(e));
    }
  });

  const pickLocale = (l: Locale) => {
    setLocale(l);
    void setAppLocale(l);
  };

  return (
    <AuthShell
      title={t('auth:register')}
      subtitle={t('auth:registerBody')}
      onBack={() => nav.goBack()}
      footer={
        <Text
          variant="micro"
          tone="tertiary"
          center
          className="font-normal"
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
        >
          {t('auth:termsNote')}
        </Text>
      }
    >
      <View className="gap-3">
        <View className="flex-row gap-2">
          {LOCALES.map((l) => (
            <Chip
              key={l}
              label={t(`common:language.${l}`)}
              selected={l === locale}
              onPress={() => pickLocale(l)}
              className="h-11"
            />
          ))}
        </View>
        <Controller
          control={form.control}
          name="displayName"
          render={({ field, fieldState }) => (
            <Input
              icon="user"
              placeholder={t('auth:fullName')}
              textContentType="name"
              returnKeyType="next"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
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
              textContentType="newPassword"
              returnKeyType="next"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="confirm"
          render={({ field, fieldState }) => (
            <PasswordInput
              icon="lock"
              placeholder={t('auth:confirmPassword')}
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
        <Button
          label={t('auth:register')}
          onPress={() => void submit()}
          loading={form.formState.isSubmitting}
          className="mt-1"
        />
      </View>
    </AuthShell>
  );
}
