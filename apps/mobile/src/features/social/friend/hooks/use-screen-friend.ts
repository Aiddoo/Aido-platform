import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useEffect } from 'react';

import { useGetFriendInfiniteQueryOptions } from '../queries/friend.queries';
import { friendParamsSchema } from '../schemas/friend-params.schema';

/** 친구 화면의 friendId로 친구를 읽고, 아직 불러오지 않은 페이지에 있으면 다음 페이지를 이어 불러온다. */
export function useScreenFriend() {
  const [{ friendId }] = useRouteParams(friendParamsSchema);
  const query = useSuspenseInfiniteQuery(useGetFriendInfiniteQueryOptions({ friendId }));
  const { data: friend, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query;

  useEffect(() => {
    if (!friend && hasNextPage && !isFetching && !isFetchNextPageError) {
      fetchNextPage({ cancelRefetch: false }).catch(noop);
    }
  }, [friend, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  return query;
}
