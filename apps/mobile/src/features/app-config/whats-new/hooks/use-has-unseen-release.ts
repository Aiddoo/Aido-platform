import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useSyncStorage } from '@src/shared/di/shared-di-context';
import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';
import { useQuery } from '@tanstack/react-query';

import { createWhatsNewSeenKey } from '../apis/whats-new.repository';
import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';

/** 본 기록을 구독해, 흐름을 보고 돌아오면 메뉴와 목록의 점이 바로 사라진다 */
export function useHasUnseenRelease(): boolean {
  const { data: user } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });
  const { campaignId } = WhatsNewPolicy.getLatestRelease(RELEASES);
  const syncStorage = useSyncStorage();
  const [seenAt] = useSyncStorageString(
    syncStorage,
    createWhatsNewSeenKey({ userId: user?.id ?? '', campaignId }),
  );

  return (
    user != null && WhatsNewPolicy.hasUnseenRelease(RELEASES, seenAt == null ? [] : [campaignId])
  );
}
