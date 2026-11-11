import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useEffect } from 'react';

import { useGetFriendInfiniteQueryOptions } from '../queries/friend.queries';

/** 친구를 읽고, 아직 불러오지 않은 페이지에 있으면 다음 페이지를 이어 불러온다. */
export function useFriendQuery(friendId: string) {
  const query = useSuspenseInfiniteQuery(useGetFriendInfiniteQueryOptions({ friendId }));
  const { data: friend, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query;

  const shouldFetchNextPage = !friend && hasNextPage && !isFetching && !isFetchNextPageError;

  useEffect(() => {
    if (shouldFetchNextPage) {
      fetchNextPage({ cancelRefetch: false }).catch(noop);
    }
  }, [shouldFetchNextPage, fetchNextPage]);

  return query;
}
