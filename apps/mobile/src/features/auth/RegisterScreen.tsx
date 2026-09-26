import { zodResolver } from '@hookform/resolvers/zod';
import { LOCALES, type Locale } from '@movo/contracts';
import { Button, Chip, Input, PasswordInput, Text, TitleBar } from '@movo/design-system';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';
import { useErrorMessage } from '../../core/api/use-error-message';
import { signUp } from '../../core/auth/auth';
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
    <AuthShell title={t('auth:register')}>
      <TitleBar
        title=""
        onBack={() => nav.goBack()}
        className="absolute -top-[132px] left-0 right-0"
      />
      <View className="gap-3">
        <View>
          <Text variant="label" tone="secondary" className="mb-1.5">
            {t('common:language.label')}
          </Text>
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
        </View>
        <Controller
          control={form.control}
          name="displayName"
          render={({ field, fieldState }) => (
            <Input
              label={t('auth:fullName')}
              textContentType="name"
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
              label={t('auth:identifier')}
              placeholder={t('auth:identifierHint')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
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
              textContentType="newPassword"
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
              label={t('auth:confirmPassword')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
        <Button
          label={t('common:actions.continue')}
          onPress={() => void submit()}
          loading={form.formState.isSubmitting}
          className="mt-2"
        />
        <Text variant="micro" tone="tertiary" center className="mt-2 font-normal">
          {t('auth:termsNote')}
        </Text>
      </View>
    </AuthShell>
  );
}
