import { useInviteService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { InviteService } from '../apis/invite.service';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';

export function getInviteQueryOptions(inviteService: InviteService) {
  return queryOptions({
    queryKey: INVITE_QUERY_KEYS.invite(),
    queryFn: async ({ signal }) => unwrap(await inviteService.getInvite(signal)),
  });
}

export function useGetInviteQueryOptions() {
  return getInviteQueryOptions(useInviteService());
}
