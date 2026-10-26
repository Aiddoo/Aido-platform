import { useInviteService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { InviteService } from '../apis/invite.service';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import type { InviteCode } from '../domains/invite.model';

// 코드 입력에서 확인한 미리보기를 초대 카드가 다시 부르지 않게 잠깐 둔다
const INVITE_PREVIEW_STALE_TIME_MS = 60 * 1000;

export function getInvitePreviewQueryOptions(
  inviteService: InviteService,
  { inviteCode }: { inviteCode: InviteCode },
) {
  return queryOptions({
    queryKey: INVITE_QUERY_KEYS.preview({ inviteCode }),
    queryFn: async ({ signal }) => unwrap(await inviteService.getPreview(inviteCode, signal)),
    staleTime: INVITE_PREVIEW_STALE_TIME_MS,
  });
}

export function useGetInvitePreviewQueryOptions({ inviteCode }: { inviteCode: InviteCode }) {
  return getInvitePreviewQueryOptions(useInviteService(), { inviteCode });
}
