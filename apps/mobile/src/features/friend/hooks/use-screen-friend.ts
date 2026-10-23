import { useSuspenseInfiniteQuery } from '@tanstack/react-query';

import { useGetFriendQueryOptions } from '../queries/get-friend-query-options';
import { useFriendScreenParams } from './use-friend-screen-params';

/** 친구 화면의 friendId로 이미 불러온 친구를 읽는다. 목록에 없으면 null이다. */
export function useScreenFriend() {
  const { friendId } = useFriendScreenParams();
  const { data: friend } = useSuspenseInfiniteQuery(useGetFriendQueryOptions({ friendId }));

  return friend;
}
