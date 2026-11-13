import {
  useDraftService,
  useMarketingPushPromptRepository,
  useQueryCacheStorage,
  useVoiceNoteStorageService,
} from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import {
  selectAccountId,
  useGetMeQueryOptions,
} from '@src/features/identity/user/queries/user.queries';
import { getNowInstant } from '@src/shared/date/clock';
import { toEpochMs } from '@src/shared/date/instant';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * 로그인한 계정을 기기에 저장된 초안, 조회 캐시, 음성 메모, 계정 구분 없던 안내 기록의 주인으로 정하고 다른 계정의 것은 지운다.
 * 복원한 조회 캐시의 내 정보는 지난 실행의 다른 계정일 수 있어 이 마운트 뒤에 받은 내 정보로만 정한다
 */
export function useClaimDeviceDataForUser(): void {
  const status = useAuthStatus();
  const draftService = useDraftService();
  const queryCacheStorage = useQueryCacheStorage();
  const voiceNoteStorageService = useVoiceNoteStorageService();
  const marketingPushPromptRepository = useMarketingPushPromptRepository();
  const isAuthenticated = status === 'authenticated';
  const [mountedAtMs] = useState(() => toEpochMs(getNowInstant()));
  const { data: accountId, dataUpdatedAt } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: isAuthenticated,
    throwOnError: false,
    select: selectAccountId,
  });
  const meId = isAuthenticated && mountedAtMs <= dataUpdatedAt ? (accountId ?? null) : null;

  useEffect(() => {
    if (meId != null) {
      draftService.removeAllExceptOwner(meId);
      queryCacheStorage.setOwner(meId);
      voiceNoteStorageService.removeAllExceptOwner(meId);
      voiceNoteStorageService.removeExpired(meId);
      marketingPushPromptRepository.claimDeviceRecord(meId);
    }
  }, [
    meId,
    draftService,
    queryCacheStorage,
    voiceNoteStorageService,
    marketingPushPromptRepository,
  ]);
}
