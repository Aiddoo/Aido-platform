import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useQuery } from '@tanstack/react-query';

import type { CoachmarkKind } from '../schemas/coachmark.schema';
import { usePendingCoachmark } from './use-pending-coachmark';

export function useMyPendingCoachmark(kind: CoachmarkKind) {
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });

  return usePendingCoachmark({ accountId: me?.id ?? null, kind });
}
