import {
  type AuditArea,
  type ModuleKey,
  type ModuleState,
  type PermissionKey,
  type RouteBody,
  societyContract,
} from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { societyKey } from '../../core/api/query-keys';
import { useCursorList } from '../../core/api/use-cursor-list';
import { invalidateContext } from '../../core/auth/auth';
import { directoryKeys } from '../../core/members/keys';
import { societyKeys } from '../../core/society/keys';
import { manageKeys } from '../../core/society/manage-keys';

export function useCreateBuilding(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.createBuilding>) =>
      api(societyContract.createBuilding, { params: { societyId }, body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: societyKey(societyId) }),
  });
}

export function useCreateFlats(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.createFlats>) =>
      api(societyContract.createFlats, { params: { societyId }, body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: societyKey(societyId) }),
  });
}

export function useInvitations(societyId: string) {
  return useCursorList({
    queryKey: manageKeys(societyId).invitations,
    fetchPage: (cursor) =>
      api(societyContract.listInvitations, {
        params: { societyId },
        query: { cursor, limit: 30 },
      }),
  });
}

export function useCreateInvitation(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.createInvitation>) =>
      api(societyContract.createInvitation, { params: { societyId }, body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: manageKeys(societyId).invitations });
    },
  });
}

export function useRevokeInvitation(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      api(societyContract.revokeInvitation, { params: { societyId, invitationId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: manageKeys(societyId).invitations }),
  });
}

export function useJoinRequests(societyId: string) {
  return useQuery({
    queryKey: manageKeys(societyId).joinRequests,
    queryFn: () =>
      api(societyContract.listJoinRequests, {
        params: { societyId },
        query: { status: 'PENDING' },
      }),
  });
}

export function useDecideJoinRequest(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      approve,
    }: {
      requestId: string;
      approve: boolean;
    }): Promise<unknown> =>
      approve
        ? api(societyContract.approveJoinRequest, { params: { societyId, requestId }, body: {} })
        : api(societyContract.rejectJoinRequest, { params: { societyId, requestId }, body: {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: manageKeys(societyId).joinRequests });
      void qc.invalidateQueries({ queryKey: directoryKeys(societyId).lists });
    },
  });
}

export function useRotateJoinCode(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api(societyContract.update, { params: { societyId }, body: { rotateJoinCode: true } }),
    onSuccess: (profile) => qc.setQueryData(societyKeys(societyId).profile, profile),
  });
}

export function useUpdateSociety(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.update>) =>
      api(societyContract.update, { params: { societyId }, body }),
    onSuccess: (profile) => {
      qc.setQueryData(societyKeys(societyId).profile, profile);
      void invalidateContext();
    },
  });
}

export function useSaveRole(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      ...body
    }: {
      roleId?: string | undefined;
      name: string;
      permissions: PermissionKey[];
    }) =>
      roleId
        ? api(societyContract.updateRole, { params: { societyId, roleId }, body })
        : api(societyContract.createRole, { params: { societyId }, body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: manageKeys(societyId).roles });
      void invalidateContext();
    },
  });
}

export function useDeleteRole(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) =>
      api(societyContract.deleteRole, { params: { societyId, roleId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: manageKeys(societyId).roles }),
  });
}

export function useModules(societyId: string) {
  return useQuery({
    queryKey: manageKeys(societyId).modules,
    queryFn: () => api(societyContract.listModules, { params: { societyId } }),
  });
}

export function useUpdateModule(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      moduleKey,
      ...body
    }: {
      moduleKey: ModuleKey;
      enabled?: boolean;
      settings?: Record<string, unknown>;
    }) => api(societyContract.updateModule, { params: { societyId, moduleKey }, body }),
    onSuccess: (state) => {
      qc.setQueryData<ModuleState[]>(manageKeys(societyId).modules, (old) =>
        old?.map((m) => (m.key === state.key ? state : m)),
      );
      // Every screen reads module switches and settings from the context.
      void invalidateContext();
      void qc.invalidateQueries({ queryKey: societyKey(societyId) });
    },
  });
}

export function useAuditLog(societyId: string, area: AuditArea | undefined) {
  return useCursorList({
    queryKey: manageKeys(societyId).audit(area ?? 'all'),
    fetchPage: (cursor) =>
      api(societyContract.listAudit, {
        params: { societyId },
        query: { area, cursor, limit: 30 },
      }),
  });
}
