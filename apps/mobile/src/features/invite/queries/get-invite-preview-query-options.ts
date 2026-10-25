import { useInviteService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { InviteService } from '../apis/invite.service';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import type { InviteCode } from '../domains/invite.model';

export function getInvitePreviewQueryOptions(
  inviteService: InviteService,
  { inviteCode }: { inviteCode: InviteCode },
) {
  return queryOptions({
    queryKey: INVITE_QUERY_KEYS.preview({ inviteCode }),
    queryFn: async ({ signal }) => unwrap(await inviteService.getPreview(inviteCode, signal)),
  });
}

export function useGetInvitePreviewQueryOptions({ inviteCode }: { inviteCode: InviteCode }) {
  return getInvitePreviewQueryOptions(useInviteService(), { inviteCode });
}
