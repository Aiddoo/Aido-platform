import { useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';

/** 본 기록을 구독해, 흐름을 보고 돌아오면 메뉴와 목록의 점이 바로 사라진다 */
export function useHasUnseenRelease(): boolean {
  const repository = useWhatsNewRepository();
  const { data: user } = useQuery(useGetMeQueryOptions());
  // 지난 출시까지 점으로 남기면 오래 사라지지 않으므로 최신 출시만 본다
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
