import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { friendParamsSchema } from '../schemas/friend-params.schema';

/** 친구 피드가 보는 친구 id. 쿼리는 쓰는 컴포넌트가 `useFriendQuery`로 읽는다 */
export function useRouteFriendId() {
  const [{ friendId }] = useRouteParams(friendParamsSchema);

  return [friendId] as const;
}
