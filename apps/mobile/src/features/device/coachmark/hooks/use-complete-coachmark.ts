import { getNowInstant } from '@src/shared/date/clock';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { useCallback } from 'react';

import type { CoachmarkInput } from '../domains/coachmark.model';
import { coachmarkCompletedAtStoredValue } from '../schemas/coachmark-storage.schema';

/** 아직 끝내지 않은 안내면 지금 끝내고 true다. 이미 끝냈으면 처음 시각을 두고 false다 */
export function useCompleteCoachmark() {
  const storage = useStoredValueStorage(coachmarkCompletedAtStoredValue);

  return useCallback(
    (coachmark: CoachmarkInput): boolean => {
      if (readStoredValue(storage, coachmarkCompletedAtStoredValue, coachmark) != null) {
        return false;
      }
      writeStoredValue(storage, coachmarkCompletedAtStoredValue, getNowInstant(), coachmark);
      return true;
    },
    [storage],
  );
}
