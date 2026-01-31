import { useInfiniteQuery } from '@tanstack/react-query';

import { getNotificationsInfiniteQueryOptions } from '../queries/get-notifications-infinite-query-options';

/**
 * Hook to get paginated notifications list
 */
export const useNotifications = (unreadOnly = false) => {
  const options = getNotificationsInfiniteQueryOptions(unreadOnly);
  const query = useInfiniteQuery(options);

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    hasNextPage: query.hasNextPage,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
};
