import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAnalytics,
  useDraftService,
  useErrorReporter,
  useQueryCacheStorage,
  useVoiceNoteStorageService,
} from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/get-me-query-options';
import { toUserAnalyticsProperties } from '@src/features/identity/user/utils/user-analytics-properties';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

export const useUserIdentity = (): void => {
  const { status } = useAuth();
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const draftService = useDraftService();
  const queryCacheStorage = useQueryCacheStorage();
  const voiceNoteStorageService = useVoiceNoteStorageService();
  const isAuthenticated = status === 'authenticated';

  const { data: me } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (isAuthenticated && me) {
      analytics.setUserId(me.id);
      analytics.setUserProperties(toUserAnalyticsProperties(me));
      errorReporter.setUserId(me.id);
    } else if (!isAuthenticated) {
      analytics.clearUser();
      errorReporter.setUserId(null);
    }
  }, [isAuthenticated, me, analytics, errorReporter]);

  const meId = me?.id;
  useEffect(() => {
    if (isAuthenticated && meId != null) {
      draftService.removeAllExceptOwner(meId);
      queryCacheStorage.setOwner(meId);
      voiceNoteStorageService.removeAllExceptOwner(meId);
      voiceNoteStorageService.removeExpired(meId);
    }
  }, [isAuthenticated, meId, draftService, queryCacheStorage, voiceNoteStorageService]);
};
