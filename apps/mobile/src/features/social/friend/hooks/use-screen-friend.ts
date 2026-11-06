import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useGetFriendQueryOptions } from '../queries/get-friend-query-options';
import { useFriendScreenParams } from './use-friend-screen-params';

/** 친구 화면의 friendId로 친구를 읽고, 아직 불러오지 않은 페이지에 있으면 다음 페이지를 이어 불러온다. */
export function useScreenFriend() {
  const { friendId } = useFriendScreenParams();
  const query = useSuspenseInfiniteQuery(useGetFriendQueryOptions({ friendId }));
  const { data: friend, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query;

  useEffect(() => {
    if (!friend && hasNextPage && !isFetching && !isFetchNextPageError) {
      fetchNextPage({ cancelRefetch: false }).catch(() => undefined);
    }
  }, [friend, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  return query;
}
