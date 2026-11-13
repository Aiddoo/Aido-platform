import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { useCallback } from 'react';

import { type CoachmarkInput, CoachmarkPolicy } from '../domains/coachmark.model';
import { coachmarkCompletedAtStoredValue } from '../schemas/coachmark-storage.schema';
import { useCompleteCoachmark } from './use-complete-coachmark';

interface PendingCoachmarkInput extends Omit<CoachmarkInput, 'accountId'> {
  /** 내 정보를 아직 못 읽었으면 null이다. 그동안은 남은 안내가 없는 것으로 본다 */
  accountId: string | null;
}

// 저장 값을 구독해 다른 화면이 끝내거나(claim·complete) 탈퇴 정리가 지워도 바로 따라간다
export function usePendingCoachmark({ accountId, kind }: PendingCoachmarkInput) {
  const [completedAt] = useStoredValue(
    coachmarkCompletedAtStoredValue,
    accountId == null ? null : { accountId, kind },
  );
  const completeCoachmark = useCompleteCoachmark();
  const isPending = accountId != null && CoachmarkPolicy.shouldShow({ kind, completedAt });
  const complete = useCallback(() => {
    if (accountId != null) {
      completeCoachmark({ accountId, kind });
    }
  }, [accountId, kind, completeCoachmark]);

  return [isPending, complete] as const;
}
