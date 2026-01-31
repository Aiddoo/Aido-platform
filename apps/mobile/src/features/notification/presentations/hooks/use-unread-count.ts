import { useQuery } from '@tanstack/react-query';

import { getUnreadCountQueryOptions } from '../queries/get-unread-count-query-options';

/**
 * Hook to get unread notification count
 */
export const useUnreadCount = () => {
  const options = getUnreadCountQueryOptions();
  const query = useQuery(options);

  return {
    unreadCount: query.data ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};
