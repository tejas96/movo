import { type QueryKey, useInfiniteQuery } from '@tanstack/react-query';

/** One page of a cursor-paged list endpoint. */
export interface CursorPage<T> {
  items: T[];
  nextCursor?: string | null;
}

export interface CursorListOptions<P> {
  queryKey: QueryKey;
  /** Loads one page; `cursor` is undefined for the first page. */
  fetchPage: (cursor: string | undefined) => Promise<P>;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

/** A cursor-paged list: the next page starts at the last page's `nextCursor`. */
export function useCursorList<P extends CursorPage<unknown>>(options: CursorListOptions<P>) {
  const { fetchPage, ...rest } = options;
  return useInfiniteQuery({
    ...rest,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: P) => last.nextCursor ?? undefined,
  });
}

export type CursorList<P extends CursorPage<unknown>> = ReturnType<typeof useCursorList<P>>;

/** Every loaded item, in order. */
export function listItems<T>(list: { data?: { pages: CursorPage<T>[] } }): T[] {
  return list.data?.pages.flatMap((p) => p.items) ?? [];
}
