import {
  useDraftService,
  useQueryCacheStorage,
  useVoiceNoteStorageService,
} from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

/** 로그인한 계정을 기기에 저장된 초안, 조회 캐시, 음성 메모의 주인으로 정하고 다른 계정의 것은 지운다 */
export function useClaimDeviceDataForUser(): void {
  const status = useAuthStatus();
  const draftService = useDraftService();
  const queryCacheStorage = useQueryCacheStorage();
  const voiceNoteStorageService = useVoiceNoteStorageService();
  const isAuthenticated = status === 'authenticated';

  const { data: meId } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: isAuthenticated,
    select: (me) => me.id,
  });

  useEffect(() => {
    if (isAuthenticated && meId != null) {
      draftService.removeAllExceptOwner(meId);
      queryCacheStorage.setOwner(meId);
      voiceNoteStorageService.removeAllExceptOwner(meId);
      voiceNoteStorageService.removeExpired(meId);
    }
  }, [isAuthenticated, meId, draftService, queryCacheStorage, voiceNoteStorageService]);
}
