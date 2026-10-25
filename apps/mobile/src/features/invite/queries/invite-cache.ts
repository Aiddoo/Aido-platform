import type { QueryClient } from '@tanstack/react-query';

import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import type { Invite } from '../domains/invite.model';

/** 링크를 새로 만들면 서버가 돌려준 요약으로 바로 바꾸고, 이전 코드 미리보기는 버린다 */
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
