import {
  useDraftService,
  useMarketingPushPromptRepository,
  useQueryCacheStorage,
  useVoiceNoteStorageService,
} from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useEffect } from 'react';

/** 로그인한 계정을 기기에 저장된 초안, 조회 캐시, 음성 메모, 계정 구분 없던 안내 기록의 주인으로 정하고 다른 계정의 것은 지운다 */
export function useClaimDeviceDataForUser(): void {
  const status = useAuthStatus();
  const draftService = useDraftService();
  const queryCacheStorage = useQueryCacheStorage();
  const voiceNoteStorageService = useVoiceNoteStorageService();
  const marketingPushPromptRepository = useMarketingPushPromptRepository();
  const isAuthenticated = status === 'authenticated';

  const meId = useMyAccountId({ isEnabled: isAuthenticated });

  useEffect(() => {
    if (isAuthenticated && meId != null) {
      draftService.removeAllExceptOwner(meId);
      queryCacheStorage.setOwner(meId);
      voiceNoteStorageService.removeAllExceptOwner(meId);
      voiceNoteStorageService.removeExpired(meId);
      marketingPushPromptRepository.claimDeviceRecord(meId);
    }
  }, [
    isAuthenticated,
    meId,
    draftService,
    queryCacheStorage,
    voiceNoteStorageService,
    marketingPushPromptRepository,
  ]);
}
