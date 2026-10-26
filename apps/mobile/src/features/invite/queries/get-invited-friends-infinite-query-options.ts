import type { RedemptionStatus } from '@aido/api';
import { useInviteService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import type { Page } from '@src/shared/types/page.type';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';
import { orderBy as orderByFn } from 'es-toolkit';

import type { InviteService } from '../apis/invite.service';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import {
  type InvitedFriend,
  InvitedFriendPolicy,
  orderByJoinedAtDesc,
  orderByWaitingFirst,
} from '../domains/invited-friend.model';

const FIRST_PAGE_CURSOR: string | null = null;
const INVITED_FRIENDS_PAGE_SIZE = 20;

interface InviteesFilter {
  /** 상태별 목록. 없으면 전체다 */
  status?: RedemptionStatus;
}

/** 상태마다 다른 캐시를 둔다. 서버가 상태로 거르고 totalCount도 그 조건으로 센다 */
export function getInvitedFriendsInfiniteQueryOptions(
  inviteService: InviteService,
  { status }: InviteesFilter = {},
) {
  return infiniteQueryOptions({
    queryKey: INVITE_QUERY_KEYS.invitees({ status }),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await inviteService.getInvitedFriends(
          {
            cursor: pageParam ?? undefined,
            limit: INVITED_FRIENDS_PAGE_SIZE,
            status,
          },
          signal,
        ),
      ),
    initialPageParam: FIRST_PAGE_CURSOR,
    // 친구 목록과 같이 마지막 userId가 다음 cursor다
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.items.at(-1)?.userId : undefined),
  });
}

// 서버가 이미 최근 가입 순(joinedAt desc, id desc)으로 페이지를 주므로 이어 붙이기만 한다
function selectInvitedFriends(
  invitedFriendPages: InfiniteData<Page<InvitedFriend>, string | null>,
) {
  return invitedFriendPages.pages.flatMap((page) => page.items);
}

export function useGetInvitedFriendsInfiniteQueryOptions({ status }: InviteesFilter) {
  return infiniteQueryOptions({
    ...getInvitedFriendsInfiniteQueryOptions(useInviteService(), { status }),
    select: selectInvitedFriends,
  });
}

/**
 * 내 초대 화면 요약. 전체 목록과 같은 쿼리를 읽어 기다리는 친구를 먼저, 최근 가입 순으로 앞 몇 명만 고른다.
 * 받은 페이지 안에서만 고르므로 첫 페이지 밖의 기다리는 친구는 전체 보기에서 본다.
 */
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
