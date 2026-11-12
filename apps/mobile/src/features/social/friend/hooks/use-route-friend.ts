import { noop } from 'es-toolkit';
import { match, P } from 'ts-pattern';

import type { FriendUser } from '../domains/friend.model';
import { useFriendQuery } from './use-friend-query';
import { useRouteFriendId } from './use-route-friend-id';

/** route의 친구를 친구 목록에서 찾은 결과. 아직 읽지 않은 쪽을 읽는 중·그 쪽을 읽지 못함·찾음·더는 친구가 아님이다 */
export type RouteFriend =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; reset: () => void }
  | { status: 'ready'; friend: FriendUser }
  | { status: 'missing' };

/** route의 friendId를 친구 목록에서 확인한다. 아직 읽지 않은 쪽에 있으면 이어 읽고, 끝까지 없으면 더는 친구가 아니다 */
export function useRouteFriend(): RouteFriend {
  const [friendId] = useRouteFriendId();
  const {
    data: friend,
    hasNextPage,
    isFetchNextPageError,
    error,
    fetchNextPage,
  } = useFriendQuery(friendId);

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
