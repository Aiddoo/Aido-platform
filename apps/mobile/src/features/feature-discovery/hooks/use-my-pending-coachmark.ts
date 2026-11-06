import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useQuery } from '@tanstack/react-query';

import type { CoachmarkKind } from '../apis/coachmark.repository';
import { usePendingCoachmark } from './use-pending-coachmark';

export function useMyPendingCoachmark(kind: CoachmarkKind) {
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });

  return usePendingCoachmark({ accountId: me?.id ?? null, kind });
}
