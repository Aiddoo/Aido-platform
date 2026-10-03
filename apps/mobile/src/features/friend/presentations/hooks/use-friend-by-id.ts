import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useGetFriendQueryOptions } from '../queries/get-friend-query-options';

export function useFriendById(friendId: string) {
  const {
    data: friend,
    hasNextPage,
    isFetching,
    isFetchNextPageError,
    error,
    fetchNextPage,
  } = useSuspenseInfiniteQuery(useGetFriendQueryOptions({ friendId }));

  useEffect(() => {
    if (!friend && hasNextPage && !isFetching && !isFetchNextPageError)
      void fetchNextPage({ cancelRefetch: false }).catch(() => undefined);
  }, [friend, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  return { friend, hasNextPage, isFetching, isFetchNextPageError, error, fetchNextPage };
}
