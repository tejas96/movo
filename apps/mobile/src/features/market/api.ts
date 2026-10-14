import { type ListingKind, marketContract, type OrderRole, type RouteBody } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { useCursorList } from '../../core/api/use-cursor-list';
import { homeKeys } from '../home/keys';
import { marketKeys } from './keys';

const c = marketContract;

export function useListings(
  societyId: string,
  kind: ListingKind | undefined,
  q: string,
  enabled = true,
) {
  return useCursorList({
    enabled,
    queryKey: marketKeys(societyId).listings(`${kind ?? 'ALL'}|${q}`),
    fetchPage: (cursor) =>
      api(c.listListings, {
        params: { societyId },
        query: { kind, q: q || undefined, cursor, limit: 20 },
      }),
  });
}

export function useMyListings(societyId: string) {
  return useQuery({
    queryKey: marketKeys(societyId).mine,
    queryFn: () => api(c.myListings, { params: { societyId } }),
  });
}

export function useListing(societyId: string, listingId: string) {
  return useQuery({
    queryKey: marketKeys(societyId).listing(listingId),
    queryFn: () => api(c.getListing, { params: { societyId, listingId } }),
    enabled: Boolean(listingId),
  });
}

export function useOrders(societyId: string, role: OrderRole) {
  return useQuery({
    queryKey: marketKeys(societyId).orders(role),
    queryFn: () => api(c.listOrders, { params: { societyId }, query: { role } }),
  });
}

/** No realtime yet, so an open order polls every 15 seconds. */
export function useOrder(societyId: string, orderId: string) {
  return useQuery({
    queryKey: marketKeys(societyId).order(orderId),
    queryFn: () => api(c.getOrder, { params: { societyId, orderId } }),
    refetchInterval: 15_000,
  });
}

export function useMarketReports(societyId: string, enabled: boolean) {
  return useQuery({
    queryKey: marketKeys(societyId).reports,
    queryFn: () => api(c.listReports, { params: { societyId } }),
    enabled,
  });
}

/** Orders change quantities and listings change what orders show, so refresh the whole market. */
function useInvalidate(societyId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: marketKeys(societyId).all });
    void qc.invalidateQueries({ queryKey: homeKeys(societyId).all });
  };
}

export type ListingBody = RouteBody<typeof c.createListing>;

export function useSaveListing(societyId: string, listingId: string | undefined) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (body: ListingBody) =>
      listingId
        ? api(c.updateListing, { params: { societyId, listingId }, body })
        : api(c.createListing, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export type ListingAction =
  | { kind: 'status'; status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' }
  | { kind: 'report'; reason: string }
  | { kind: 'hide'; reason: string }
  | { kind: 'unhide' };

export function useListingAction(societyId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: ({
      listingId,
      action: a,
    }: {
      listingId: string;
      action: ListingAction;
    }): Promise<unknown> => {
      const params = { societyId, listingId };
      switch (a.kind) {
        case 'status':
          return api(c.setListingStatus, { params, body: { status: a.status } });
        case 'report':
          return api(c.reportListing, { params, body: { reason: a.reason } });
        case 'hide':
          return api(c.hideListing, { params, body: { reason: a.reason } });
        case 'unhide':
          return api(c.unhideListing, { params });
      }
    },
    onSuccess: invalidate,
  });
}

export function useDismissReport(societyId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (reportId: string) => api(c.dismissReport, { params: { societyId, reportId } }),
    onSuccess: invalidate,
  });
}

export function useCreateOrder(societyId: string, listingId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof c.createOrder>) =>
      api(c.createOrder, { params: { societyId, listingId }, body }),
    onSuccess: invalidate,
  });
}

export type OrderAction =
  | { kind: 'accept' | 'ready' | 'complete' }
  | { kind: 'reject' | 'cancel'; reason?: string | undefined }
  | { kind: 'message'; body: string }
  | { kind: 'review'; rating: number; text?: string | null };

export function useOrderAction(societyId: string, orderId: string) {
  const invalidate = useInvalidate(societyId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: OrderAction) => {
      const params = { societyId, orderId };
      const reason = a.kind === 'reject' || a.kind === 'cancel' ? a.reason : undefined;
      switch (a.kind) {
        case 'accept':
          return api(c.acceptOrder, { params });
        case 'ready':
          return api(c.markOrderReady, { params });
        case 'complete':
          return api(c.completeOrder, { params });
        case 'reject':
          return api(c.rejectOrder, { params, body: reason ? { reason } : {} });
        case 'cancel':
          return api(c.cancelOrder, { params, body: reason ? { reason } : {} });
        case 'message':
          return api(c.sendMessage, { params, body: { body: a.body } });
        case 'review':
          return api(c.reviewOrder, { params, body: { rating: a.rating, text: a.text ?? null } });
      }
    },
    onSuccess: (order) => {
      qc.setQueryData(marketKeys(societyId).order(orderId), order);
      invalidate();
    },
  });
}
