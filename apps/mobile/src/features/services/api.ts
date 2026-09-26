import { type RouteBody, type Vendor, type VendorStatus, vendorsContract } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

type Filter = { categoryId?: string; q?: string; status?: VendorStatus };

export function useVendorCategories(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).vendorCategories,
    queryFn: () => api(vendorsContract.listCategories, { params: { societyId } }),
    staleTime: 60_000,
  });
}

export function useVendors(societyId: string, filter: Filter, enabled = true) {
  return useQuery({
    queryKey: keys.society(societyId).vendors(JSON.stringify(filter)),
    queryFn: () =>
      api(vendorsContract.list, {
        params: { societyId },
        query: { categoryId: filter.categoryId, q: filter.q || undefined, status: filter.status },
      }),
    enabled,
    staleTime: 30_000,
  });
}

export function useVendor(societyId: string, vendorId: string) {
  return useQuery({
    queryKey: keys.society(societyId).vendor(vendorId),
    queryFn: () => api(vendorsContract.get, { params: { societyId, vendorId } }),
    enabled: Boolean(vendorId),
  });
}

function useInvalidateVendors(societyId: string) {
  const qc = useQueryClient();
  return (vendor?: Vendor) => {
    void qc.invalidateQueries({ queryKey: [...keys.society(societyId).all, 'vendors'] });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
    if (vendor) qc.setQueryData(keys.society(societyId).vendor(vendor.id), vendor);
  };
}

export function useSaveVendor(societyId: string, vendorId?: string) {
  const invalidate = useInvalidateVendors(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof vendorsContract.create>) =>
      vendorId
        ? api(vendorsContract.update, { params: { societyId, vendorId }, body })
        : api(vendorsContract.create, { params: { societyId }, body }),
    onSuccess: (v) => invalidate(v),
  });
}

export function useUpdateVendor(societyId: string, vendorId: string) {
  const invalidate = useInvalidateVendors(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof vendorsContract.update>) =>
      api(vendorsContract.update, { params: { societyId, vendorId }, body }),
    onSuccess: (v) => invalidate(v),
  });
}

export function useDeleteVendor(societyId: string, vendorId: string) {
  const invalidate = useInvalidateVendors(societyId);
  return useMutation({
    mutationFn: () => api(vendorsContract.remove, { params: { societyId, vendorId } }),
    onSuccess: () => invalidate(),
  });
}

export function useSaveCategory(societyId: string) {
  const invalidate = useInvalidateVendors(societyId);
  return useMutation({
    mutationFn: ({
      categoryId,
      body,
    }: {
      categoryId?: string;
      body: RouteBody<typeof vendorsContract.createCategory>;
    }) =>
      categoryId
        ? api(vendorsContract.updateCategory, { params: { societyId, categoryId }, body })
        : api(vendorsContract.createCategory, { params: { societyId }, body }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCategory(societyId: string) {
  const invalidate = useInvalidateVendors(societyId);
  return useMutation({
    mutationFn: (categoryId: string) =>
      api(vendorsContract.deleteCategory, { params: { societyId, categoryId } }),
    onSuccess: () => invalidate(),
  });
}
