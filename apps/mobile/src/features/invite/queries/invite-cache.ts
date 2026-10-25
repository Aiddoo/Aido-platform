import { invalidateFriends } from '@src/features/friend/queries/friend-cache';
import { invalidateMe } from '@src/features/user/queries/user-cache';
import type { QueryClient } from '@tanstack/react-query';

import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import type { RedemptionResult } from '../domains/invite-redemption.model';
import type { InviteCode } from '../domains/invite.model';
import type { Invite } from '../domains/invite.model';

/** 링크를 새로 만들면 서버가 돌려준 요약으로 바로 바꾸고(다시 불러올 때 깜빡이지 않게), 이전 코드 미리보기는 버린다 */
export function replaceMyInvite(queryClient: QueryClient, myInvite: Invite) {
  queryClient.setQueryData(INVITE_QUERY_KEYS.invite(), myInvite);
  queryClient.removeQueries({ queryKey: INVITE_QUERY_KEYS.previews() });
}

/** 발자국·친구 상태가 바뀌는 알림을 받거나 당겨서 새로고침할 때 */
export function invalidateInvite(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: INVITE_QUERY_KEYS.invite() }),
    queryClient.invalidateQueries({ queryKey: INVITE_QUERY_KEYS.inviteeLists() }),
  ]);
}

/** 수락하면 친구·친구 요청과 프리미엄(보상 기간)이 함께 바뀌고, 쓴 코드의 미리보기는 더 필요 없다 */
export function invalidateAfterRedeem(
  queryClient: QueryClient,
  { inviteCode }: { inviteCode: InviteCode },
) {
  queryClient.removeQueries({ queryKey: INVITE_QUERY_KEYS.preview({ inviteCode }) });
  return Promise.all([invalidateFriends(queryClient), invalidateMe(queryClient)]);
}

/** 환영 시트가 서버를 다시 부르지 않고 방금 받은 수락 결과를 읽게 남긴다 */
export function storeRedemptionResult(queryClient: QueryClient, result: RedemptionResult) {
  queryClient.setQueryData(
    INVITE_QUERY_KEYS.redemption({ inviterId: result.inviter.userId }),
    result,
  );
}

/** 서버가 초대가 꺼졌다고 답하면 진입점이 숨도록 사용 가능 여부를 다시 받는다 */
export function invalidateInviteAvailability(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: INVITE_QUERY_KEYS.availability() });
}

/** 진입점을 hook 밖(mutation 오류 처리 등)에서 정할 때 이미 받은 사용 가능 여부를 읽는다 */
export function getCachedInviteAvailability(queryClient: QueryClient) {
  return queryClient.getQueryData<boolean>(INVITE_QUERY_KEYS.availability()) ?? false;
}

/** 친구가 가입했거나 발자국이 찍혔다는 알림을 받으면 초대 요약·목록, 친구 목록, 프리미엄을 함께 새로 고친다 */
export async function invalidateOnInviteNotification(queryClient: QueryClient) {
  await Promise.all([
    invalidateInvite(queryClient),
    invalidateFriends(queryClient),
    invalidateMe(queryClient),
  ]);
}
