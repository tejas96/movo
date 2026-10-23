import { Glass, SectionLabel } from '@movo/design-system';
import { Fragment, type ReactElement, useCallback, useMemo, useRef } from 'react';
import { FlatList, type FlatListProps, type ListRenderItem, StyleSheet } from 'react-native';
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

type PagedListProps<T, U> = Omit<
  FlatListProps<U>,
  'data' | 'onEndReached' | 'refreshing' | 'onRefresh' | 'ListEmptyComponent'
> & {
  list: PagedQuery<T>;
  /**
   * Turns the loaded items into the rows to draw (filter, group). Without it the rows are the
   * items. Keep it stable (useCallback) so the rows only change when the pages do.
   */
  select?: (items: T[]) => U[];
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
  /**
   * All rows in one glass card, as on the mockup's lists. A string adds a small capitals label
   * at the top of the card. The rows drop their own pill inside it.
   */
  glass?: boolean | string;
};

/**
 * A cursor-paged FlatList: loads the next page at the end, pulls to refresh, and shows the
 * skeleton, error (with retry) and empty state the same way on every list screen.
 */
export function PagedList<T, U = T>({
  list,
  select,
  empty,
  errorClassName,
  loading,
  loadingMore,
  glass,
  ...rest
}: PagedListProps<T, U>) {
  // Same array while the pages are the same, so FlatList and memoized rows skip work.
  const data = list.data;
  const items = useMemo(() => {
    const loaded = data ? listItems({ data }) : [];
    return select ? select(loaded) : (loaded as unknown as U[]);
  }, [data, select]);
  // The query object is new on every render; read it through a ref so handlers stay stable.
  const latest = useRef(list);
  latest.current = list;
  const onEndReached = useCallback(() => {
    const l = latest.current;
    if (l.hasNextPage && !l.isFetchingNextPage) void l.fetchNextPage();
  }, []);
  const onRefresh = useCallback(() => void latest.current.refetch(), []);
  const error = <QueryError query={list} className={errorClassName} />;

  if (loading) {
    if (list.isLoading) return loading;
    if (loadFailed(list)) return error;
    if (items.length === 0) return empty;
  }

  if (glass) {
    const { renderItem, keyExtractor, ...flat } = rest;
    const group: ListRenderItem<U[]> = ({ item: rows, separators }) => (
      <Glass radius={28} style={styles.group}>
        {typeof glass === 'string' ? <SectionLabel>{glass}</SectionLabel> : null}
        {rows.map((row, index) => (
          <Fragment key={keyExtractor ? keyExtractor(row, index) : String(index)}>
            {renderItem?.({ item: row, index, separators })}
          </Fragment>
        ))}
      </Glass>
    );
    return (
      <FlatList
        {...(flat as Omit<FlatListProps<U[]>, 'data' | 'renderItem'>)}
        data={items.length > 0 ? [items] : []}
        keyExtractor={groupKey}
        renderItem={group}
        onEndReached={onEndReached}
        refreshing={list.isRefetching}
        onRefresh={onRefresh}
        ListEmptyComponent={
          loading || list.isLoading ? undefined : loadFailed(list) ? error : empty
        }
        ListFooterComponent={
          loadingMore && list.isFetchingNextPage ? loadingMore : rest.ListFooterComponent
        }
      />
    );
  }

  return (
    <FlatList
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={11}
      {...rest}
      data={items}
      onEndReached={onEndReached}
      refreshing={list.isRefetching}
      onRefresh={onRefresh}
      ListEmptyComponent={loading || list.isLoading ? undefined : loadFailed(list) ? error : empty}
      ListFooterComponent={
        loadingMore && list.isFetchingNextPage ? loadingMore : rest.ListFooterComponent
      }
    />
  );
}

const groupKey = () => 'glass-list';

const styles = StyleSheet.create({
  group: { padding: 8 },
});
