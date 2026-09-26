import { authContract, type Locale, meContract, societyContract } from '@movo/contracts';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../core/api/client';
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

export function useUpdatePrivacy(societyId: string) {
  return useMutation({
    mutationFn: (body: { showPhone?: boolean; showEmail?: boolean }) =>
      api(societyContract.updateMyPrivacy, { params: { societyId }, body }),
  });
}
