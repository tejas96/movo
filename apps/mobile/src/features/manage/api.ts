import {
  type AuditArea,
  type ModuleKey,
  type ModuleState,
  type PermissionKey,
  type RouteBody,
  societyContract,
} from '@movo/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';
import { invalidateContext } from '../../core/auth/auth';

export function useBuildings(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).buildings,
    queryFn: () => api(societyContract.listBuildings, { params: { societyId } }),
  });
}

export function useFlats(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).flats,
    queryFn: () => api(societyContract.listFlats, { params: { societyId } }),
  });
}

export function useCreateBuilding(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.createBuilding>) =>
      api(societyContract.createBuilding, { params: { societyId }, body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.society(societyId).all }),
  });
}

export function useCreateFlats(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.createFlats>) =>
      api(societyContract.createFlats, { params: { societyId }, body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.society(societyId).all }),
  });
}

export function useInvitations(societyId: string) {
  return useInfiniteQuery({
    queryKey: keys.society(societyId).invitations,
    queryFn: ({ pageParam }) =>
      api(societyContract.listInvitations, {
        params: { societyId },
        query: { cursor: pageParam, limit: 30 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useCreateInvitation(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.createInvitation>) =>
      api(societyContract.createInvitation, { params: { societyId }, body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.society(societyId).invitations });
      void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
    },
  });
}

export function useRevokeInvitation(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      api(societyContract.revokeInvitation, { params: { societyId, invitationId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.society(societyId).invitations }),
  });
}

export function useJoinRequests(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).joinRequests,
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
      void qc.invalidateQueries({ queryKey: keys.society(societyId).joinRequests });
      void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
      void qc.invalidateQueries({ queryKey: [...keys.society(societyId).all, 'members'] });
    },
  });
}

export function useRotateJoinCode(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api(societyContract.update, { params: { societyId }, body: { rotateJoinCode: true } }),
    onSuccess: (profile) => qc.setQueryData(keys.society(societyId).profile, profile),
  });
}

export function useUpdateSociety(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.update>) =>
      api(societyContract.update, { params: { societyId }, body }),
    onSuccess: (profile) => {
      qc.setQueryData(keys.society(societyId).profile, profile);
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
      void qc.invalidateQueries({ queryKey: keys.society(societyId).roles });
      void invalidateContext();
    },
  });
}

export function useDeleteRole(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) =>
      api(societyContract.deleteRole, { params: { societyId, roleId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.society(societyId).roles }),
  });
}

export function useModules(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).modules,
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
      qc.setQueryData<ModuleState[]>(keys.society(societyId).modules, (old) =>
        old?.map((m) => (m.key === state.key ? state : m)),
      );
      // Every screen reads module switches and settings from the context.
      void invalidateContext();
      void qc.invalidateQueries({ queryKey: keys.society(societyId).all });
    },
  });
}

export function useAuditLog(societyId: string, area: AuditArea | undefined) {
  return useInfiniteQuery({
    queryKey: keys.society(societyId).audit(area ?? 'all'),
    queryFn: ({ pageParam }) =>
      api(societyContract.listAudit, {
        params: { societyId },
        query: { area, cursor: pageParam, limit: 30 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
