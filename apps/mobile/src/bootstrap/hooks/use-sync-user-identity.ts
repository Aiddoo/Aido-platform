import { useAnalytics, useErrorReporter } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { toUserAnalyticsProperties } from '@src/features/identity/user/utils/user-analytics';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useSyncUserIdentity(): void {
  const status = useAuthStatus();
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const isAuthenticated = status === 'authenticated';

  const { data: me } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (isAuthenticated && me != null) {
      analytics.setUserId(me.id);
      analytics.setUserProperties(toUserAnalyticsProperties(me));
      errorReporter.setUserId(me.id);
    } else if (!isAuthenticated) {
      analytics.clearUser();
      errorReporter.setUserId(null);
    }
  }, [isAuthenticated, me, analytics, errorReporter]);
}
