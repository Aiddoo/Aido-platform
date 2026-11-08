import { useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';

export function useHasUnseenRelease(): boolean {
  const repository = useWhatsNewRepository();
  const { data: user } = useQuery(useGetMeQueryOptions());
  const { campaignId } = WhatsNewPolicy.getLatestRelease(RELEASES);
  const userId = user?.id;
  const identity = useMemo(
    () => (userId == null ? null : { userId, campaignId }),
    [userId, campaignId],
  );

  return useSyncExternalStore(
    useCallback(
      (onChange: () => void) =>
        identity == null ? noop : repository.subscribe(identity, onChange),
      [identity, repository],
    ),
    () => identity != null && !repository.hasSeen(identity),
  );
}
