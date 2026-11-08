import { useCoachmarkService } from '@src/bootstrap/providers/di-context';
import { useCallback, useSyncExternalStore } from 'react';

import type { CoachmarkInput } from '../domains/coachmark.model';

interface PendingCoachmarkInput extends Omit<CoachmarkInput, 'accountId'> {
  accountId: string | null;
}

export function usePendingCoachmark({ accountId, kind }: PendingCoachmarkInput) {
  const service = useCoachmarkService();
  const isPending = useSyncExternalStore(
    service.subscribe,
    () => accountId != null && service.isPending({ accountId, kind }),
  );
  const complete = useCallback(() => {
    if (accountId != null) {
      service.complete({ accountId, kind });
    }
  }, [accountId, kind, service]);

  return [isPending, complete] as const;
}
