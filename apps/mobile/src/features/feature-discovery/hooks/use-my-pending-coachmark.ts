import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useQuery } from '@tanstack/react-query';

import type { CoachmarkKind } from '../apis/coachmark.repository';
import { usePendingCoachmark } from './use-pending-coachmark';

/** 지금 계정에 안내가 남았는지. 내 정보를 아직 못 읽었으면 남은 안내가 없는 것으로 본다 */
export function useMyPendingCoachmark(kind: CoachmarkKind) {
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });

  return usePendingCoachmark({ accountId: me?.id ?? null, kind });
}
