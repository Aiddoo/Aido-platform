import { queryOptions, skipToken } from '@tanstack/react-query';

import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import type { RedemptionResult } from '../domains/invite-redemption.model';

// 수락 응답은 다시 조회할 API가 없어 수락 mutation이 넣어 둔 값만 읽는다(skipToken이라 fetch하지 않는다).
// 라우트 param으로 넘기면 결과 전체를 URL에 직렬화해야 하고 딥링크로 결과를 꾸며 열 수 있어 캐시로 넘긴다
const REDEMPTION_RESULT_GC_TIME_MS = 10 * 60 * 1000;

/** inviterId가 null이면(형식이 틀린 링크) 넣어 둔 값이 없어 늘 비어 있다 */
export function getRedemptionResultQueryOptions({ inviterId }: { inviterId: string | null }) {
  return queryOptions<RedemptionResult>({
    queryKey: INVITE_QUERY_KEYS.redemption({ inviterId }),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: REDEMPTION_RESULT_GC_TIME_MS,
  });
}
