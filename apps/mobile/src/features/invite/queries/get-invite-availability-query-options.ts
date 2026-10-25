import { useInviteService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { InviteService } from '../apis/invite.service';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';

// 운영 플래그라 자주 바뀌지 않는다. 진입점이 여러 곳이어도 한 번만 묻는다
const AVAILABILITY_STALE_TIME_MS = 5 * 60 * 1000;

export function getInviteAvailabilityQueryOptions(inviteService: InviteService) {
  return queryOptions({
    queryKey: INVITE_QUERY_KEYS.availability(),
    queryFn: async ({ signal }) => unwrap(await inviteService.getAvailability(signal)),
    staleTime: AVAILABILITY_STALE_TIME_MS,
  });
}

export function useGetInviteAvailabilityQueryOptions() {
  return getInviteAvailabilityQueryOptions(useInviteService());
}
