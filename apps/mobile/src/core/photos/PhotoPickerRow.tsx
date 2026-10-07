import type { FileRef, UploadKind } from '@movo/contracts';
import { cn, Icon, Text, theme, useToast } from '@movo/design-system';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { fileUri, uploadFile } from '../api/client';
import { useErrorMessage } from '../api/use-error-message';
import { PhotoSourceSheet } from './PhotoSourceSheet';
import { type PhotoSource, pickPhotos } from './pick';

const THUMB = 96;

export interface PickedPhoto {
  key: string;
  /** Local file while uploading, the stored photo after. */
  uri: string;
  ref: FileRef | null;
  state: 'uploading' | 'done' | 'failed';
}

let seq = 0;

/**
 * Photo list state for a form: take or pick photos, upload each one right away as `kind`.
 * The form sends `ids` when it saves.
 */
export function usePhotoPicker(
  societyId: string,
  { kind, max, maxSide = 1600 }: { kind: UploadKind; max: number; maxSide?: number },
) {
  const { t } = useTranslation('common');
  const toast = useToast();
  const toMessage = useErrorMessage();
  const [items, setItems] = useState<PickedPhoto[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const patch = useCallback((key: string, p: Partial<PickedPhoto>) => {
    setItems((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));
  }, []);

  const reset = useCallback((refs: FileRef[]) => {
    setItems(refs.map((ref) => ({ key: ref.id, uri: fileUri(ref), ref, state: 'done' as const })));
  }, []);

  const pick = useCallback(
    async (source: PhotoSource) => {
      const res = await pickPhotos(source, { limit: max - itemsRef.current.length, maxSide });
      if (!res.ok) {
        if (res.reason === 'denied') toast.show(t('photo.cameraDenied'), 'error');
        if (res.reason === 'failed') toast.show(t('photo.uploadFailed'), 'error');
        return;
      }
      if (res.tooBig) toast.show(t('photo.tooBig'), 'error');
      const added: PickedPhoto[] = res.assets.map((a) => ({
        key: `local-${seq++}`,
        uri: a.uri as string,
        ref: null,
        state: 'uploading',
      }));
      setItems((list) => [...list, ...added]);
      await Promise.all(
        added.map(async (item, i) => {
          const asset = res.assets[i];
          try {
            const ref = await uploadFile(
              societyId,
              { uri: item.uri, fileName: asset?.fileName, type: asset?.type },
              kind,
            );
            patch(item.key, { ref, state: 'done' });
          } catch (e) {
            patch(item.key, { state: 'failed' });
            toast.show(toMessage(e), 'error');
          }
        }),
      );
    },
    [societyId, kind, max, maxSide, patch, t, toast, toMessage],
  );

  const remove = useCallback((key: string) => {
    setItems((list) => list.filter((x) => x.key !== key));
  }, []);

  return {
    items,
    max,
    pick,
    remove,
    reset,
    uploading: items.some((x) => x.state === 'uploading'),
    failed: items.some((x) => x.state === 'failed'),
    ids: items.flatMap((x) => (x.ref ? [x.ref.id] : [])),
  };
}

export type PhotoPicker = ReturnType<typeof usePhotoPicker>;

/**
 * Thumbnails with a remove button and an add tile that offers the camera or the gallery.
 * `showCover` marks the first photo (listings). `onGray` when the row sits in a gray sheet.
 */
export function PhotoPickerRow({
  picker,
  showCover = false,
  onGray = false,
}: {
  picker: PhotoPicker;
  showCover?: boolean;
  onGray?: boolean;
}) {
  const { t } = useTranslation('common');
  const [choosing, setChoosing] = useState(false);
  const { items, max } = picker;
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {items.map((item, i) => (
          <View
            key={item.key}
            style={{ width: THUMB, height: THUMB }}
            className="overflow-hidden rounded-md bg-card"
          >
            <Image
              source={{ uri: item.uri }}
              resizeMode="cover"
              style={{ width: THUMB, height: THUMB }}
            />
            {item.state !== 'done' ? (
              <View className="absolute inset-0 items-center justify-center bg-overlay">
                {item.state === 'uploading' ? (
                  <ActivityIndicator color={theme.color.bg.ink} />
                ) : (
                  <Icon name="warning" variant="bold" size={24} />
                )}
              </View>
            ) : null}
            {showCover && i === 0 && item.state === 'done' ? (
              <View className="absolute bottom-1.5 left-1.5 rounded-full bg-overlay px-2 py-0.5">
                <Text variant="micro">{t('photo.cover')}</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('photo.remove')}
              hitSlop={8}
              onPress={() => picker.remove(item.key)}
              className="absolute right-1.5 top-1.5 h-7 w-7 items-center justify-center rounded-full bg-card-nested"
            >
              <Icon name="close" variant="bold" size={26} />
            </Pressable>
          </View>
        ))}
        {items.length < max ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('photo.add')}
            onPress={() => setChoosing(true)}
            style={{ width: THUMB, height: THUMB }}
            className={cn(
              'items-center justify-center gap-1 rounded-md active:bg-card-deep',
              onGray ? 'bg-card-nested' : 'bg-card',
            )}
          >
            <Icon name="galleryAdd" size={26} />
            <Text variant="micro" tone="secondary">
              {`${items.length}/${max}`}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <PhotoSourceSheet
        visible={choosing}
        onClose={() => setChoosing(false)}
        onPick={(source) => void picker.pick(source)}
      />
    </>
  );
}

/** PhotoPickerRow with a label above and a short help line below. */
export function PhotoField({
  label,
  help,
  picker,
  onGray,
}: {
  label: string;
  help?: string;
  picker: PhotoPicker;
  onGray?: boolean;
}) {
  return (
    <View>
      <Text variant="label" tone="secondary" className="mb-1.5">
        {label}
      </Text>
      <PhotoPickerRow picker={picker} onGray={onGray} />
      {help ? (
        <Text variant="micro" tone="secondary" className="mt-1.5 font-normal">
          {help}
        </Text>
      ) : null}
    </View>
  );
}
