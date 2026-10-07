import { FILE_MAX_BYTES, FILE_MIME_TYPES } from '@movo/contracts';
import { useToast } from '@movo/design-system';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PermissionsAndroid, Platform } from 'react-native';
import { type Asset, launchCamera, launchImageLibrary } from 'react-native-image-picker';

export type PhotoSource = 'camera' | 'library';

export type PickResult =
  | { ok: true; assets: Asset[]; tooBig: number }
  | { ok: false; reason: 'cancelled' | 'denied' | 'failed' };

/**
 * Android asks at run time because the app declares CAMERA (the AR guide). iOS asks by itself
 * the first time, with the NSCameraUsageDescription text.
 */
async function cameraAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * One photo from the camera, or up to `limit` from the gallery. The phone shrinks each one to
 * `maxSide` pixels before upload, so the server needs no image tools.
 */
export async function pickPhotos(
  source: PhotoSource,
  { limit, maxSide }: { limit: number; maxSide: number },
): Promise<PickResult> {
  if (limit <= 0) return { ok: false, reason: 'cancelled' };
  const options = {
    mediaType: 'photo' as const,
    maxWidth: maxSide,
    maxHeight: maxSide,
    quality: 0.8 as const,
    saveToPhotos: false,
  };
  if (source === 'camera' && !(await cameraAllowed())) return { ok: false, reason: 'denied' };
  const res =
    source === 'camera'
      ? await launchCamera({ ...options, cameraType: 'back' })
      : await launchImageLibrary({ ...options, selectionLimit: limit });
  if (res.didCancel) return { ok: false, reason: 'cancelled' };
  if (res.errorCode === 'permission') return { ok: false, reason: 'denied' };
  if (res.errorCode || !res.assets) return { ok: false, reason: 'failed' };
  let tooBig = 0;
  const assets = res.assets.slice(0, limit).filter((a) => {
    if (!a.uri) return false;
    if ((a.fileSize ?? 0) > FILE_MAX_BYTES) {
      tooBig++;
      return false;
    }
    return !a.type || (FILE_MIME_TYPES as readonly string[]).includes(a.type);
  });
  return { ok: true, assets, tooBig };
}

/** Picks one photo and shows the toast for anything that went wrong. null = nothing picked. */
export function usePickOne() {
  const { t } = useTranslation('common');
  const toast = useToast();
  return useCallback(
    async (source: PhotoSource, maxSide: number): Promise<Asset | null> => {
      const res = await pickPhotos(source, { limit: 1, maxSide });
      if (!res.ok) {
        if (res.reason === 'denied') toast.show(t('photo.cameraDenied'), 'error');
        if (res.reason === 'failed') toast.show(t('photo.uploadFailed'), 'error');
        return null;
      }
      if (res.tooBig) toast.show(t('photo.tooBig'), 'error');
      return res.assets[0] ?? null;
    },
    [t, toast],
  );
}
