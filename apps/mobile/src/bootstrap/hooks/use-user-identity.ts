import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAnalytics,
  useDraftService,
  useErrorReporter,
  useQueryCacheStorage,
} from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { toUserAnalyticsProperties } from '@src/features/user/utils/user-analytics-properties';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

export const useUserIdentity = (): void => {
  const { status } = useAuth();
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const draftService = useDraftService();
  const queryCacheStorage = useQueryCacheStorage();
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
    }
  }, [isAuthenticated, meId, draftService, queryCacheStorage]);
};
