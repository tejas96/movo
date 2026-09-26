import { FILE_MAX_BYTES, FILE_MIME_TYPES, type FileRef } from '@movo/contracts';
import { Icon, Text, theme, useToast } from '@movo/design-system';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { fileUri, uploadFile } from '../../core/api/client';
import { useErrorMessage } from '../../core/api/use-error-message';

export const MAX_PHOTOS = 5;
const THUMB = 96;

export interface PickedPhoto {
  key: string;
  /** Local file while uploading, the stored photo after. */
  uri: string;
  ref: FileRef | null;
  state: 'uploading' | 'done' | 'failed';
}

let seq = 0;

/** Photo list state for a form: pick from the gallery, upload each one right away. */
export function usePhotoPicker(societyId: string) {
  const { t } = useTranslation('market');
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

  const pick = useCallback(async () => {
    const remaining = MAX_PHOTOS - itemsRef.current.length;
    if (remaining <= 0) return;
    const res = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.8,
      selectionLimit: remaining,
    });
    if (res.didCancel || !res.assets) return;
    if (res.errorCode) {
      toast.show(t('editor.uploadFailed'), 'error');
      return;
    }
    const accepted = res.assets.slice(0, remaining).filter((a) => {
      if (!a.uri) return false;
      if ((a.fileSize ?? 0) > FILE_MAX_BYTES) {
        toast.show(t('editor.tooBig'), 'error');
        return false;
      }
      return !a.type || (FILE_MIME_TYPES as readonly string[]).includes(a.type);
    });
    const added: PickedPhoto[] = accepted.map((a) => ({
      key: `local-${seq++}`,
      uri: a.uri as string,
      ref: null,
      state: 'uploading',
    }));
    setItems((list) => [...list, ...added]);
    await Promise.all(
      added.map(async (item, i) => {
        const asset = accepted[i];
        try {
          const ref = await uploadFile(societyId, {
            uri: item.uri,
            fileName: asset?.fileName,
            type: asset?.type,
          });
          patch(item.key, { ref, state: 'done' });
        } catch (e) {
          patch(item.key, { state: 'failed' });
          toast.show(toMessage(e), 'error');
        }
      }),
    );
  }, [societyId, patch, t, toast, toMessage]);

  const remove = useCallback((key: string) => {
    setItems((list) => list.filter((x) => x.key !== key));
  }, []);

  return {
    items,
    pick,
    remove,
    reset,
    uploading: items.some((x) => x.state === 'uploading'),
    failed: items.some((x) => x.state === 'failed'),
    ids: items.flatMap((x) => (x.ref ? [x.ref.id] : [])),
  };
}

export type PhotoPicker = ReturnType<typeof usePhotoPicker>;

/** Thumbnails with a remove button and an add tile. The first photo is the cover. */
export function PhotoPickerRow({ picker }: { picker: PhotoPicker }) {
  const { t } = useTranslation('market');
  const { items } = picker;
  return (
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
          {i === 0 && item.state === 'done' ? (
            <View className="absolute bottom-1.5 left-1.5 rounded-full bg-overlay px-2 py-0.5">
              <Text variant="micro">{t('editor.cover')}</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('editor.clear')}
            hitSlop={8}
            onPress={() => picker.remove(item.key)}
            className="absolute right-1.5 top-1.5 h-7 w-7 items-center justify-center rounded-full bg-card-nested"
          >
            <Icon name="close" variant="bold" size={26} />
          </Pressable>
        </View>
      ))}
      {items.length < MAX_PHOTOS ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('editor.photos')}
          onPress={() => void picker.pick()}
          style={{ width: THUMB, height: THUMB }}
          className="items-center justify-center gap-1 rounded-md bg-card active:bg-card-deep"
        >
          <Icon name="galleryAdd" size={26} />
          <Text variant="micro" tone="secondary">
            {`${items.length}/${MAX_PHOTOS}`}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
