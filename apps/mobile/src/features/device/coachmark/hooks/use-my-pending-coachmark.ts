import type { CoachmarkKind } from '../domains/coachmark.model';
import { useMyAccountId } from './use-my-account-id';
import { usePendingCoachmark } from './use-pending-coachmark';

export function useMyPendingCoachmark(kind: CoachmarkKind) {
  const accountId = useMyAccountId();

  return usePendingCoachmark({ accountId, kind });
}
