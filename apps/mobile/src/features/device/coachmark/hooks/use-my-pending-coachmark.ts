import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';

import type { CoachmarkKind } from '../domains/coachmark.model';
import { usePendingCoachmark } from './use-pending-coachmark';

export function useMyPendingCoachmark(kind: CoachmarkKind) {
  const accountId = useMyAccountId();

  return usePendingCoachmark({ accountId, kind });
}
