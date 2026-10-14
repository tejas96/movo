import { EmptyState } from '@movo/design-system';
import { useTranslation } from 'react-i18next';

/** The part of a react-query result the error block needs. Fits useQuery and useInfiniteQuery. */
interface RetryableQuery {
  isError: boolean;
  isFetching: boolean;
  data: unknown;
  refetch: () => Promise<unknown>;
}

/**
 * True when the load failed and there is nothing to show. A failed background refetch keeps
 * the saved data on screen, so that is not a load error.
 */
export function loadFailed(query: Pick<RetryableQuery, 'isError' | 'data'>): boolean {
  return query.isError && query.data === undefined;
}

/**
 * "Something went wrong" with a retry button. Shown instead of the empty state or the
 * skeleton when a query fails, so "server down" never looks like "nothing here".
 */
export function QueryError({ query, className }: { query: RetryableQuery; className?: string }) {
  const { t } = useTranslation('common');
  return (
    <EmptyState
      icon="warning"
      title={t('states.errorTitle')}
      body={t('states.errorBody')}
      actionLabel={t('actions.retry')}
      onAction={() => void query.refetch()}
      actionLoading={query.isFetching}
      className={className ?? ''}
    />
  );
}
