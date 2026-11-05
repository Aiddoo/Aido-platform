import { useInviteService, useLogger } from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import { getErrorMessage } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { InviteService } from '../apis/invite.service';
import { INVITE_LOG_EVENT } from '../constants/invite-log-events';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import { isInviteDisabledError } from '../domains/invite.error';
import { invalidateInviteAvailability } from './invite-cache';

// 발자국은 친구가 할 일을 끝낼 때 바뀌어서 짧게만 재사용한다
const INVITE_STALE_TIME_MS = 30 * 1000;

export function getInviteQueryOptions(inviteService: InviteService, logger: Logger) {
  return queryOptions({
    queryKey: INVITE_QUERY_KEYS.invite(),
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

export function useGetInviteQueryOptions() {
  return getInviteQueryOptions(useInviteService(), useLogger());
}
