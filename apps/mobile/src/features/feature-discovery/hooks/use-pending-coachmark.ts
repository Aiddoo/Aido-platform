import { useCoachmarkService } from '@src/bootstrap/providers/di-context';
import { useCallback, useSyncExternalStore } from 'react';

import type { CoachmarkInput } from '../apis/coachmark.repository';

/** 쓰거나 닫아야 끝나는 안내가 아직 남았는지와, 끝내는 함수 */
export function usePendingCoachmark({ accountId, kind }: CoachmarkInput) {
  const service = useCoachmarkService();
  const isPending = useSyncExternalStore(service.subscribe, () =>
    service.isPending({ accountId, kind }),
  );
  const complete = useCallback(
    () => service.complete({ accountId, kind }),
    [accountId, kind, service],
  );

  return [isPending, complete] as const;
}
