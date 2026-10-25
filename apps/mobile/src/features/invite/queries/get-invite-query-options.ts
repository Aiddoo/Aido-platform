import { useInviteService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { InviteService } from '../apis/invite.service';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';

// 발자국은 친구가 할 일을 끝낼 때 바뀌어서 짧게만 재사용한다
const INVITE_STALE_TIME_MS = 30 * 1000;

export function getInviteQueryOptions(inviteService: InviteService) {
  return queryOptions({
    queryKey: INVITE_QUERY_KEYS.invite(),
    queryFn: async ({ signal }) => unwrap(await inviteService.getInvite(signal)),
    staleTime: INVITE_STALE_TIME_MS,
  });
}

export function useGetInviteQueryOptions() {
  return getInviteQueryOptions(useInviteService());
}
