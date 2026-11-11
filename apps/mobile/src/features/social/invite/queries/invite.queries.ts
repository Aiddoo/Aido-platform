import type { RedemptionStatus } from '@aido/api/vocabulary';
import { useInviteService, useLogger } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { DEFAULT_PAGE_SIZE } from '@src/shared/constants/page-size';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { getErrorMessage } from '@src/shared/errors';
import type { Page } from '@src/shared/types/page.types';
import {
  queryOptions,
  type InfiniteData,
  infiniteQueryOptions,
  skipToken,
} from '@tanstack/react-query';
import { orderBy } from 'es-toolkit';

import { INVITE_LOG_EVENT } from '../constants/invite-log-events';
import { INVITED_FRIEND_SUMMARY_LIMIT } from '../constants/invite.constants';
import type { InviteCode } from '../domains/invite-code.model';
import type { RedemptionResult } from '../domains/invite-redemption.model';
import { isInviteDisabledError } from '../domains/invite.error';
import { InvitedFriendPolicy } from '../domains/invited-friend.model';
import type { InvitedFriend } from '../domains/invited-friend.model';
import { invalidateInviteAvailability } from './invite-cache';
import { INVITE_QUERY_KEYS } from './invite-query-keys';

// 운영 플래그라 자주 바뀌지 않는다. 진입점이 여러 곳이어도 한 번만 묻는다
const AVAILABILITY_STALE_TIME_MS = 5 * MINUTE_MS;

export function useGetInviteAvailabilityQueryOptions() {
  const inviteService = useInviteService();

  return queryOptions({
    queryKey: INVITE_QUERY_KEYS.availability(),
    queryFn: async ({ signal }) => unwrap(await inviteService.getAvailability(signal)),
    staleTime: AVAILABILITY_STALE_TIME_MS,
  });
}

// 코드 입력에서 확인한 미리보기를 초대 카드가 다시 부르지 않게 잠깐 둔다
const INVITE_PREVIEW_STALE_TIME_MS = MINUTE_MS;

export function useGetInvitePreviewQueryOptions({ inviteCode }: { inviteCode: InviteCode }) {
  const inviteService = useInviteService();

  return queryOptions({
    queryKey: INVITE_QUERY_KEYS.preview({ inviteCode }),
    queryFn: async ({ signal }) => unwrap(await inviteService.getPreview(inviteCode, signal)),
    staleTime: INVITE_PREVIEW_STALE_TIME_MS,
  });
}

// 발자국은 친구가 할 일을 끝낼 때 바뀌어서 짧게만 재사용한다
const INVITE_STALE_TIME_MS = 30 * SECOND_MS;

export function useGetInviteQueryOptions() {
  const inviteService = useInviteService();
  const logger = useLogger();

  return queryOptions({
    queryKey: INVITE_QUERY_KEYS.me(),
    queryFn: async ({ signal, client }) => {
      const result = await inviteService.getInvite(signal);
      // 서버가 초대가 꺼졌다고 답하면 진입점이 숨도록 사용 가능 여부를 다시 받는다
      if (!result.ok && isInviteDisabledError(result.error)) {
        invalidateInviteAvailability(client).catch((error) =>
          logger.warn(INVITE_LOG_EVENT.AVAILABILITY_REFRESH_FAILED, {
            error: getErrorMessage(error),
          }),
        );
      }
      return unwrap(result);
    },
    staleTime: INVITE_STALE_TIME_MS,
  });
}

const FIRST_PAGE_CURSOR: string | undefined = undefined;

interface InviteesFilter {
  /** 상태별 목록. 없으면 전체다 */
  status?: RedemptionStatus;
}

/** 상태마다 다른 캐시를 둔다. 서버가 상태로 거르고 totalCount도 그 조건으로 센다 */
export function useGetInvitedFriendsInfiniteQueryOptions({ status }: InviteesFilter) {
  const inviteService = useInviteService();

  return infiniteQueryOptions({
    queryKey: INVITE_QUERY_KEYS.invitees({ status }),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await inviteService.getInvitedFriends(
          {
            cursor: pageParam,
            limit: DEFAULT_PAGE_SIZE,
            status,
          },
          signal,
        ),
      ),
    initialPageParam: FIRST_PAGE_CURSOR,
    // 친구 목록과 같이 마지막 userId가 다음 cursor다
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.items.at(-1)?.userId : undefined),
    select: selectInvitedFriends,
  });
}

// 서버가 이미 최근 가입 순(joinedAt desc, id desc)으로 페이지를 주므로 이어 붙이기만 한다
function selectInvitedFriends(
  invitedFriendPages: InfiniteData<Page<InvitedFriend>, string | undefined>,
) {
  return invitedFriendPages.pages.flatMap((page) => page.items);
}

/**
 * 내 초대 화면 요약. 전체 목록과 같은 쿼리를 읽어 기다리는 친구를 먼저, 최근 가입 순으로 앞 몇 명만 고른다.
 * 받은 페이지 안에서만 고르므로 첫 페이지 밖의 기다리는 친구는 전체 보기에서 본다.
 */
function selectInvitedFriendSummary(
  invitedFriendPages: InfiniteData<Page<InvitedFriend>, string | undefined>,
) {
  const totalCount = selectInvitedFriendTotalCount(invitedFriendPages);
  const invitedFriends = orderBy(
    invitedFriendPages.pages.flatMap((page) => page.items),
    [InvitedFriendPolicy.orderByWaitingFirst, InvitedFriendPolicy.orderByJoinedAtDesc],
    ['asc', 'asc'],
  );

  return {
    invitedFriends: invitedFriends.slice(0, INVITED_FRIEND_SUMMARY_LIMIT),
    totalCount,
    hasMore: totalCount > INVITED_FRIEND_SUMMARY_LIMIT,
  };
}

export function useGetInvitedFriendSummaryInfiniteQueryOptions() {
  return infiniteQueryOptions({
    ...useGetInvitedFriendsInfiniteQueryOptions({}),
    select: selectInvitedFriendSummary,
  });
}

function selectInvitedFriendTotalCount(
  invitedFriendPages: InfiniteData<Page<InvitedFriend>, string | undefined>,
) {
  return invitedFriendPages.pages[0]?.totalCount ?? 0;
}

/** 전체 탭 숫자. 전체 목록 첫 페이지의 totalCount만 읽는다 */
export function useGetInvitedFriendCountInfiniteQueryOptions() {
  return infiniteQueryOptions({
    ...useGetInvitedFriendsInfiniteQueryOptions({}),
    select: selectInvitedFriendTotalCount,
  });
}

// 수락 응답은 다시 조회할 API가 없어 수락 mutation이 넣어 둔 값만 읽는다(skipToken이라 fetch하지 않는다).
// 라우트 param으로 넘기면 결과 전체를 URL에 직렬화해야 하고 딥링크로 결과를 꾸며 열 수 있어 캐시로 넘긴다
const REDEMPTION_RESULT_GC_TIME_MS = 10 * MINUTE_MS;

/** inviterId가 null이면(형식이 틀린 링크) 넣어 둔 값이 없어 늘 비어 있다 */
export function useGetRedemptionResultQueryOptions({ inviterId }: { inviterId: string | null }) {
  return queryOptions<RedemptionResult>({
    queryKey: INVITE_QUERY_KEYS.redemption({ inviterId }),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: REDEMPTION_RESULT_GC_TIME_MS,
  });
}
