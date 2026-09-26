import {
  BottomBar,
  Button,
  Chip,
  Input,
  OptionSheet,
  Screen,
  SelectField,
  Skeleton,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { parseRupees, rupeesText } from '../../core/util/money';
import { useRoles } from '../directory/api';
import { useModules, useUpdateModule } from './api';
import { MODULE_SETTINGS, type SettingField } from './module-settings';

type Values = Record<string, unknown>;

export function ModuleSettingsScreen() {
  const { t } = useTranslation(['manage', 'society', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const { moduleKey } = useRoute<RouteProp<RootStackParamList, 'ModuleSettings'>>().params;
  const modules = useModules(societyId);
  const roles = useRoles(societyId);
  const update = useUpdateModule(societyId);
  const current = modules.data?.find((m) => m.key === moduleKey);
  const fields = MODULE_SETTINGS[moduleKey] ?? [];

  const [values, setValues] = useState<Values>({});
  /** Number and rupee fields are edited as text and parsed on save. */
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<Extract<SettingField, { kind: 'choice' }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    setValues(current.settings);
    const next: Record<string, string> = {};
    for (const f of fields) {
      const v = current.settings[f.key];
      if (f.kind === 'number') next[f.key] = typeof v === 'number' ? String(v) : '';
      if (f.kind === 'rupees') next[f.key] = typeof v === 'number' ? rupeesText(v) : '';
    }
    setTexts(next);
  }, [current, fields]);

  const set = (key: string, value: unknown) => setValues((old) => ({ ...old, [key]: value }));
  // Field keys come from MODULE_SETTINGS, so the typed key union cannot be spelled out here.
  const tx = t as unknown as (key: string) => string;
  const label = (f: SettingField) => tx(`manage:moduleSettings.${moduleKey}.${f.key}.label`);
  const help = (f: SettingField) => tx(`manage:moduleSettings.${moduleKey}.${f.key}.help`);
  const option = (f: SettingField, v: string) =>
    tx(`manage:moduleSettings.${moduleKey}.${f.key}.options.${v}`);

  const collect = (): Values | null => {
    const out: Values = {};
    for (const f of fields) {
      if (f.kind === 'number') {
        const raw = (texts[f.key] ?? '').trim();
        if (!raw && f.nullable) {
          out[f.key] = null;
          continue;
        }
        const n = Number.parseInt(raw, 10);
        if (Number.isNaN(n) || n < f.min || n > f.max) return null;
        out[f.key] = n;
      } else if (f.kind === 'rupees') {
        const paise = parseRupees(texts[f.key] ?? '');
        if (paise === null) return null;
        out[f.key] = paise;
      } else out[f.key] = values[f.key];
    }
    return out;
  };

  const submit = async () => {
    setError(null);
    const settings = collect();
    if (!settings) {
      setError(t('manage:moduleSettings.invalid'));
      return;
    }
    try {
      await update.mutateAsync({ moduleKey, settings });
      toast.show(t('manage:moduleSettings.saved'));
      nav.goBack();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  const visible = (f: SettingField) =>
    f.kind !== 'roles' || values[f.showWhen.key] === f.showWhen.value;

  const renderField = (f: SettingField) => {
    switch (f.kind) {
      case 'toggle':
        return (
          <View className="flex-row items-center justify-between rounded-md bg-card px-[18px] py-3">
            <View className="flex-1 pr-3">
              <Text variant="body">{label(f)}</Text>
              <Text variant="caption" tone="secondary">
                {help(f)}
              </Text>
            </View>
            <Toggle value={Boolean(values[f.key])} onValueChange={(v) => set(f.key, v)} />
          </View>
        );
      case 'choice':
        return (
          <View>
            <SelectField
              label={label(f)}
              value={option(f, String(values[f.key] ?? f.options[0]))}
              onPress={() => setChoice(f)}
            />
            <Text variant="caption" tone="secondary" className="mt-1">
              {help(f)}
            </Text>
          </View>
        );
      case 'number':
      case 'rupees':
        return (
          <Input
            label={label(f)}
            helper={help(f)}
            value={texts[f.key] ?? ''}
            onChangeText={(v) => setTexts((old) => ({ ...old, [f.key]: v }))}
            keyboardType={f.kind === 'rupees' ? 'decimal-pad' : 'number-pad'}
            maxLength={f.kind === 'rupees' ? 10 : 4}
          />
        );
      case 'hours': {
        const picked = new Set(Array.isArray(values[f.key]) ? (values[f.key] as number[]) : []);
        const flip = (h: number) => {
          const next = new Set(picked);
          if (next.has(h)) next.delete(h);
          else if (next.size < f.max) next.add(h);
          set(
            f.key,
            [...next].sort((a, b) => b - a),
          );
        };
        return (
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {label(f)}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {f.options.map((h) => (
                <Chip
                  key={h}
                  label={t('manage:moduleSettings.hours', { count: h })}
                  selected={picked.has(h)}
                  onPress={() => flip(h)}
                />
              ))}
            </View>
            <Text variant="caption" tone="secondary" className="mt-1.5">
              {help(f)}
            </Text>
          </View>
        );
      }
      case 'roles': {
        const picked = new Set(Array.isArray(values[f.key]) ? (values[f.key] as string[]) : []);
        const flip = (id: string) => {
          const next = new Set(picked);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          set(f.key, [...next]);
        };
        return (
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {label(f)}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {(roles.data ?? []).map((r) => (
                <Chip
                  key={r.id}
                  label={r.name}
                  selected={picked.has(r.id)}
                  onPress={() => flip(r.id)}
                />
              ))}
            </View>
            <Text variant="caption" tone="secondary" className="mt-1.5">
              {help(f)}
            </Text>
          </View>
        );
      }
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar title={t(`society:modules.${moduleKey}`)} onBack={() => nav.goBack()} />
        {!current ? (
          <Skeleton className="mt-6 h-64 rounded-xl" />
        ) : (
          <View className="mt-6 gap-4">
            {fields.filter(visible).map((f) => (
              <View key={f.key}>{renderField(f)}</View>
            ))}
          </View>
        )}
        {error ? (
          <Text variant="caption" tone="danger" className="mt-3">
            {error}
          </Text>
        ) : null}
      </Screen>
      <BottomBar
        action={
          <Button
            label={t('common:actions.save')}
            inline
            loading={update.isPending}
            disabled={!current}
            onPress={() => void submit()}
          />
        }
      />
      <OptionSheet
        visible={choice !== null}
        onClose={() => setChoice(null)}
        title={choice ? label(choice) : undefined}
        value={choice ? String(values[choice.key] ?? '') : undefined}
        options={(choice?.options ?? []).map((v) => ({
          value: v,
          label: choice ? option(choice, v) : v,
        }))}
        onSelect={(v) => choice && set(choice.key, v)}
      />
    </>
  );
}
