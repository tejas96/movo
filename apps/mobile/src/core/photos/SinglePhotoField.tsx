import { Icon, Text, theme } from '@movo/design-system';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { PhotoSourceSheet } from './PhotoSourceSheet';
import type { PhotoSource } from './pick';

/**
 * One photo that saves as soon as it is chosen: a profile photo or the society photo.
 * `preview` draws the current photo; the parent uploads in `onPick` and clears in `onRemove`.
 */
export function SinglePhotoField({
  title,
  help,
  preview,
  hasPhoto,
  busy,
  onPick,
  onRemove,
}: {
  title: string;
  help?: string;
  preview: ReactNode;
  hasPhoto: boolean;
  busy: boolean;
  onPick: (source: PhotoSource) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('common');
  const [choosing, setChoosing] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasPhoto ? t('photo.change') : t('photo.add')}
        disabled={busy}
        onPress={() => setChoosing(true)}
        className="flex-row items-center gap-4 rounded-lg bg-card p-3 active:opacity-pressed"
      >
        <View>
          {preview}
          {busy ? (
            <View className="absolute inset-0 items-center justify-center rounded-full bg-overlay">
              <ActivityIndicator color={theme.color.bg.ink} />
            </View>
          ) : null}
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="bodyMedium" className="font-semibold">
            {title}
          </Text>
          {help ? (
            <Text variant="label" tone="secondary" className="mt-0.5">
              {help}
            </Text>
          ) : null}
          <Text variant="label" className="mt-1.5 font-semibold">
            {hasPhoto ? t('photo.change') : t('photo.add')}
          </Text>
        </View>
        <Icon name="camera" size={22} />
      </Pressable>
      <PhotoSourceSheet
        visible={choosing}
        title={title}
        onClose={() => setChoosing(false)}
        onPick={onPick}
        onRemove={hasPhoto ? onRemove : undefined}
      />
    </>
  );
}
