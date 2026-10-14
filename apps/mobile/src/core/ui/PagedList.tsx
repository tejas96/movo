import type { ReactElement } from 'react';
import { FlatList, type FlatListProps } from 'react-native';
import { type CursorPage, listItems } from '../api/use-cursor-list';
import { loadFailed, QueryError } from './QueryError';

/** The parts of a `useCursorList` result the list needs. */
interface PagedQuery<T> {
  data: { pages: CursorPage<T>[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
}

type PagedListProps<T> = Omit<
  FlatListProps<T>,
  'data' | 'onEndReached' | 'refreshing' | 'onRefresh' | 'ListEmptyComponent'
> & {
  list: PagedQuery<T>;
  /** Shown when the list loaded and has no items. */
  empty: ReactElement;
  /** Spacing class for the "something went wrong" block. */
  errorClassName?: string;
  /**
   * Skeleton for the first load. When set, the skeleton, error and empty state replace the
   * list. When left out, they render inside the list (under its header, which then shows its
   * own skeleton while `list.isLoading`).
   */
  loading?: ReactElement;
  /** Shown under the items while the next page loads. */
  loadingMore?: ReactElement;
};

/**
 * A cursor-paged FlatList: loads the next page at the end, pulls to refresh, and shows the
 * skeleton, error (with retry) and empty state the same way on every list screen.
 */
export function PagedList<T>({
  list,
  empty,
  errorClassName,
  loading,
  loadingMore,
  ...rest
}: PagedListProps<T>) {
  const items = listItems(list);
  const error = <QueryError query={list} className={errorClassName} />;

  if (loading) {
    if (list.isLoading) return loading;
    if (loadFailed(list)) return error;
    if (items.length === 0) return empty;
  }

  return (
    <FlatList
      {...rest}
      data={items}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}
      ListEmptyComponent={loading || list.isLoading ? undefined : loadFailed(list) ? error : empty}
      ListFooterComponent={
        loadingMore && list.isFetchingNextPage ? loadingMore : rest.ListFooterComponent
      }
    />
  );
}
