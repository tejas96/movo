import { maintenanceContract, type RouteBody } from '@movo/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

const c = maintenanceContract;

export function useMyDues(societyId: string, enabled = true) {
  return useQuery({
    queryKey: keys.society(societyId).myDues,
    queryFn: () => api(c.myDues, { params: { societyId } }),
    enabled,
  });
}

export function useFlatAccount(societyId: string, flatId: string) {
  return useQuery({
    queryKey: keys.society(societyId).flatAccount(flatId),
    queryFn: () => api(c.flatAccount, { params: { societyId, flatId } }),
  });
}

export function useBill(societyId: string, billId: string) {
  return useQuery({
    queryKey: keys.society(societyId).bill(billId),
    queryFn: () => api(c.getBill, { params: { societyId, billId } }),
  });
}

export function usePayments(societyId: string, flatId: string | undefined) {
  return useInfiniteQuery({
    queryKey: keys.society(societyId).payments(flatId ?? 'all'),
    queryFn: ({ pageParam }) =>
      api(c.listPayments, {
        params: { societyId },
        query: { flatId, cursor: pageParam, limit: 20 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function usePayment(societyId: string, paymentId: string) {
  return useQuery({
    queryKey: keys.society(societyId).payment(paymentId),
    queryFn: () => api(c.getPayment, { params: { societyId, paymentId } }),
  });
}

export function useCollection(societyId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.society(societyId).collection,
    queryFn: () => api(c.collection, { params: { societyId } }),
    enabled,
  });
}

export function usePlans(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).plans,
    queryFn: () => api(c.listPlans, { params: { societyId } }),
  });
}

export function useInstructions(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).instructions,
    queryFn: () => api(c.listInstructions, { params: { societyId } }),
  });
}

/** Any money change can move balances, Home and collection, so refresh them all. */
function useInvalidateMoney(societyId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.society(societyId).money });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
  };
}

export function useRecordPayment(societyId: string) {
  const invalidate = useInvalidateMoney(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof c.recordPayment>) =>
      api(c.recordPayment, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useReversePayment(societyId: string, paymentId: string) {
  const invalidate = useInvalidateMoney(societyId);
  return useMutation({
    mutationFn: (reason: string) =>
      api(c.reversePayment, { params: { societyId, paymentId }, body: { reason } }),
    onSuccess: invalidate,
  });
}

export function useBillAction(societyId: string, billId: string) {
  const invalidate = useInvalidateMoney(societyId);
  return useMutation({
    mutationFn: ({ action, reason }: { action: 'waive' | 'waiveLateFee'; reason: string }) =>
      api(action === 'waive' ? c.waiveBill : c.waiveLateFee, {
        params: { societyId, billId },
        body: { reason },
      }),
    onSuccess: invalidate,
  });
}

export function useGenerateBills(societyId: string) {
  const invalidate = useInvalidateMoney(societyId);
  return useMutation({
    mutationFn: () => api(c.generateBills, { params: { societyId } }),
    onSuccess: invalidate,
  });
}

export function useCreateAdhoc(societyId: string) {
  const invalidate = useInvalidateMoney(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof c.createAdhocBills>) =>
      api(c.createAdhocBills, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useSavePlan(societyId: string, planId: string | undefined) {
  const invalidate = useInvalidateMoney(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof c.createPlan>) =>
      planId
        ? api(c.updatePlan, { params: { societyId, planId }, body })
        : api(c.createPlan, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useSetOverride(societyId: string, planId: string) {
  const invalidate = useInvalidateMoney(societyId);
  return useMutation({
    mutationFn: (body: { flatId: string; amountPaise: number | null }) =>
      api(c.setPlanOverride, { params: { societyId, planId }, body }),
    onSuccess: invalidate,
  });
}

type InstructionInput = RouteBody<typeof c.createInstruction>;

export function useSaveInstruction(societyId: string) {
  const invalidate = useInvalidateMoney(societyId);
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: InstructionInput }) =>
      id
        ? api(c.updateInstruction, {
            params: { societyId, instructionId: id },
            body: {
              label: body.label,
              value: body.value,
              payeeName: body.payeeName ?? null,
              isActive: body.isActive,
            },
          })
        : api(c.createInstruction, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useDeleteInstruction(societyId: string) {
  const invalidate = useInvalidateMoney(societyId);
  return useMutation({
    mutationFn: (id: string) =>
      api(c.deleteInstruction, { params: { societyId, instructionId: id } }),
    onSuccess: invalidate,
  });
}
