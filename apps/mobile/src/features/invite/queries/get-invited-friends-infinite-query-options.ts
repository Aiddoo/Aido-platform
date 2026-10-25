import type { RedemptionStatus } from '@aido/api';
import { useInviteService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import type { Page } from '@src/shared/types/page.type';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';
import { orderBy as orderByFn } from 'es-toolkit';
import { useCallback } from 'react';

import type { InviteService } from '../apis/invite.service';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import {
  type InvitedFriend,
  InvitedFriendPolicy,
  type OrderByInvitedFriend,
  orderByJoinedAtDesc,
  orderByWaitingFirst,
} from '../domains/invited-friend.model';

const FIRST_PAGE_CURSOR: string | null = null;
const INVITED_FRIENDS_PAGE_SIZE = 20;

interface InviteesFilter {
  /** 상태별 목록. null이면 전체다 */
  status: RedemptionStatus | null;
}

const ALL_INVITEES: InviteesFilter = { status: null };

/** 상태마다 다른 캐시를 둔다. 서버가 상태로 거르고 totalCount도 그 조건으로 센다 */
export function getInvitedFriendsInfiniteQueryOptions(
  inviteService: InviteService,
  { status }: InviteesFilter = ALL_INVITEES,
) {
  return infiniteQueryOptions({
    queryKey: INVITE_QUERY_KEYS.invitees({ status }),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await inviteService.getInvitedFriends(
          {
            cursor: pageParam ?? undefined,
            limit: INVITED_FRIENDS_PAGE_SIZE,
            status: status ?? undefined,
          },
          signal,
        ),
      ),
    initialPageParam: FIRST_PAGE_CURSOR,
    // 친구 목록과 같이 마지막 userId가 다음 cursor다
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.items.at(-1)?.userId : undefined),
  });
}

function selectInvitedFriends(
  invitedFriendPages: InfiniteData<Page<InvitedFriend>, string | null>,
  orderBy: OrderByInvitedFriend,
) {
  return orderByFn(
    invitedFriendPages.pages.flatMap((page) => page.items),
    [orderBy],
    ['asc'],
  );
}

interface InvitedFriendsSelection extends InviteesFilter {
  /** 모듈 함수로 넘겨야 select 참조가 매 렌더 바뀌지 않는다 */
  orderBy: OrderByInvitedFriend;
}

export function useGetInvitedFriendsInfiniteQueryOptions({
  status,
  orderBy,
}: InvitedFriendsSelection) {
  const select = useCallback(
    (invitedFriendPages: InfiniteData<Page<InvitedFriend>, string | null>) =>
      selectInvitedFriends(invitedFriendPages, orderBy),
    [orderBy],
  );

  return infiniteQueryOptions({
    ...getInvitedFriendsInfiniteQueryOptions(useInviteService(), { status }),
    select,
  });
}

/** 내 초대 화면 요약. 전체 목록과 같은 쿼리를 읽어 기다리는 친구를 먼저, 최근 가입 순으로 앞 몇 명만 고른다 */
function selectInvitedFriendSummary(
  invitedFriendPages: InfiniteData<Page<InvitedFriend>, string | null>,
) {
  const totalCount = selectInvitedFriendTotalCount(invitedFriendPages);
  const invitedFriends = orderByFn(
    invitedFriendPages.pages.flatMap((page) => page.items),
    [orderByWaitingFirst, orderByJoinedAtDesc],
    ['asc', 'asc'],
  );

  return {
    invitedFriends: InvitedFriendPolicy.summaryFriends(invitedFriends),
    totalCount,
    hasMore: InvitedFriendPolicy.hasMoreThanSummary(totalCount),
  };
}

export function useGetInvitedFriendSummaryInfiniteQueryOptions() {
  return infiniteQueryOptions({
    ...getInvitedFriendsInfiniteQueryOptions(useInviteService()),
    select: selectInvitedFriendSummary,
  });
}

function selectInvitedFriendTotalCount(
  invitedFriendPages: InfiniteData<Page<InvitedFriend>, string | null>,
) {
  return invitedFriendPages.pages[0]?.totalCount ?? 0;
}

/** 전체 탭 숫자. 전체 목록 첫 페이지의 totalCount만 읽는다 */
export function useGetInvitedFriendCountInfiniteQueryOptions() {
  return infiniteQueryOptions({
    ...getInvitedFriendsInfiniteQueryOptions(useInviteService()),
    select: selectInvitedFriendTotalCount,
  });
}
