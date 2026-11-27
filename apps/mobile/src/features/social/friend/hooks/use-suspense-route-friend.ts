import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useEffect } from 'react';
import { match, P } from 'ts-pattern';

import type { FriendUser } from '../domains/friend.model';
import { useGetFriendInfiniteQueryOptions } from '../queries/friend.queries';
import { friendParamsSchema } from '../schemas/friend-params.schema';

/** route의 친구를 친구 목록에서 찾은 결과. 아직 읽지 않은 쪽을 읽는 중·그 쪽을 읽지 못함·찾음·더는 친구가 아님이다 */
export type RouteFriend =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; reset: () => void }
  | { status: 'ready'; friend: FriendUser }
  | { status: 'missing' };

/** route의 friendId를 친구 목록에서 확인한다. 친구 목록의 첫 쪽을 받을 때까지 멈추고, 아직 읽지 않은 쪽에 있으면 이어 읽고, 끝까지 없으면 더는 친구가 아니다 */
export function useSuspenseRouteFriend(): RouteFriend {
  const [friendId] = useRouteFriendId();
  const {
    data: friend,
    hasNextPage,
    isFetchNextPageError,
    error,
    fetchNextPage,
  } = useSuspenseFriendQuery(friendId);

  return match({ friend, isFetchNextPageError, hasNextPage })
    .returnType<RouteFriend>()
    .with({ friend: P.nonNullable }, ({ friend: found }) => ({ status: 'ready', friend: found }))
    .with({ isFetchNextPageError: true }, () => ({
      status: 'error',
      error,
      reset: () => fetchNextPage({ cancelRefetch: false }).catch(noop),
    }))
    .with({ hasNextPage: true }, () => ({ status: 'loading' }))
    .otherwise(() => ({ status: 'missing' }));
}

function useRouteFriendId() {
  const [{ friendId }] = useRouteParams(friendParamsSchema);

  return [friendId] as const;
}

/** 친구를 읽고, 아직 불러오지 않은 페이지에 있으면 다음 페이지를 이어 불러온다. */
function useSuspenseFriendQuery(friendId: string) {
  const query = useSuspenseInfiniteQuery(useGetFriendInfiniteQueryOptions({ friendId }));
  const { data: friend, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query;

  const shouldFetchNextPage = !friend && hasNextPage && !isFetching && !isFetchNextPageError;

  useEffect(() => {
    if (shouldFetchNextPage) {
      // 실패는 조회 캐시가 보고하고 isFetchNextPageError가 오류 화면을 연다
      fetchNextPage({ cancelRefetch: false }).catch(noop);
    }
  }, [shouldFetchNextPage, fetchNextPage]);

  return query;
}
