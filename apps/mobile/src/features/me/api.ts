import { authContract, type Locale, meContract, societyContract } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type UploadAsset, uploadAvatar } from '../../core/api/client';
import { keys } from '../../core/api/keys';
import { invalidateContext } from '../../core/auth/auth';
import { useSessionStore } from '../../core/auth/session.store';
import { setAppLocale } from '../../core/i18n';

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (body: { displayName?: string; locale?: Locale }) =>
      api(meContract.update, { body }),
    onSuccess: async (user) => {
      useSessionStore.getState().setUser(user);
      await setAppLocale(user.locale);
      await invalidateContext();
    },
  });
}

/** Profile photo: saved at once, then the directory and Me show it. */
export function useSetAvatar() {
  return useMutation({
    mutationFn: (asset: UploadAsset) => uploadAvatar(asset),
    onSuccess: async (user) => {
      useSessionStore.getState().setUser(user);
      await invalidateContext();
    },
  });
}

export function useRemoveAvatar() {
  return useMutation({
    mutationFn: () => api(meContract.removeAvatar, {}),
    onSuccess: async (user) => {
      useSessionStore.getState().setUser(user);
      await invalidateContext();
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api(authContract.changePassword, { body }),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string) => api(meContract.deleteAccount, { body: { password } }),
  });
}

export function useMyPrivacy(societyId: string) {
  return useQuery({
    queryKey: [...keys.society(societyId).all, 'my-privacy'],
    queryFn: () => api(societyContract.getMyPrivacy, { params: { societyId } }),
  });
}

export function useUpdatePrivacy(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { showPhone?: boolean; showEmail?: boolean }) =>
      api(societyContract.updateMyPrivacy, { params: { societyId }, body }),
    onSuccess: (res) =>
      qc.setQueryData(
        [...keys.society(societyId).all, 'my-privacy'],
        (old: { phoneOptInAllowed: boolean } | undefined) => ({
          ...res,
          phoneOptInAllowed: old?.phoneOptInAllowed ?? true,
        }),
      ),
  });
}
