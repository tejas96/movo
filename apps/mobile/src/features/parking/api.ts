import { parkingContract, type RouteBody } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

export type SlotFilter = 'all' | 'free' | 'taken';

export function useMyParking(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).parkingMine,
    queryFn: () => api(parkingContract.mine, { params: { societyId } }),
  });
}

export function useParkingSlots(societyId: string, filter: SlotFilter, enabled = true) {
  return useQuery({
    queryKey: keys.society(societyId).parkingSlots(filter),
    queryFn: () =>
      api(parkingContract.listSlots, {
        params: { societyId },
        query: { free: filter === 'all' ? undefined : filter === 'free' ? 'true' : 'false' },
      }),
    enabled,
  });
}

export function useVehicles(societyId: string, q: string, enabled = true) {
  return useQuery({
    queryKey: keys.society(societyId).vehicles(q),
    queryFn: () =>
      api(parkingContract.listVehicles, { params: { societyId }, query: { q: q || undefined } }),
    enabled,
  });
}

function useInvalidateParking(societyId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.society(societyId).parking });
    void qc.invalidateQueries({ queryKey: [...keys.society(societyId).all, 'member'] });
  };
}

export function useSaveVehicle(societyId: string, vehicleId?: string) {
  const invalidate = useInvalidateParking(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof parkingContract.createVehicle>) => {
      if (!vehicleId) return api(parkingContract.createVehicle, { params: { societyId }, body });
      const { flatId: _flatId, ...patch } = body;
      return api(parkingContract.updateVehicle, {
        params: { societyId, vehicleId },
        body: patch,
      });
    },
    onSuccess: invalidate,
  });
}

export function useDeleteVehicle(societyId: string) {
  const invalidate = useInvalidateParking(societyId);
  return useMutation({
    mutationFn: (vehicleId: string) =>
      api(parkingContract.deleteVehicle, { params: { societyId, vehicleId } }),
    onSuccess: invalidate,
  });
}

export function useCreateSlots(societyId: string) {
  const invalidate = useInvalidateParking(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof parkingContract.createSlots>) =>
      api(parkingContract.createSlots, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useSlotAction(societyId: string) {
  const invalidate = useInvalidateParking(societyId);
  return useMutation({
    mutationFn: (
      action:
        | { kind: 'allocate'; slotId: string; flatId: string; notes?: string | null }
        | { kind: 'release'; slotId: string }
        | { kind: 'update'; slotId: string; body: RouteBody<typeof parkingContract.updateSlot> },
    ) => {
      const params = { societyId, slotId: action.slotId };
      if (action.kind === 'allocate')
        return api(parkingContract.allocate, {
          params,
          body: { flatId: action.flatId, notes: action.notes ?? null },
        });
      if (action.kind === 'release') return api(parkingContract.release, { params });
      return api(parkingContract.updateSlot, { params, body: action.body });
    },
    onSuccess: invalidate,
  });
}
