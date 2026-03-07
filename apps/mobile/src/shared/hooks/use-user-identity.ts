import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAnalytics, useErrorReporter } from '@src/bootstrap/providers/di-provider';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

export const useUserIdentity = (): void => {
  const { status } = useAuth();
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const isAuthenticated = status === 'authenticated';

  const meQueryOptions = useGetMeQueryOptions();
  const { data: me } = useQuery({
    ...meQueryOptions,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (isAuthenticated && me) {
      analytics.setUserId(me.id);
      analytics.setUserProperties({
        is_premium: UserPolicy.isPremiumUser(me),
        subscription_status: me.subscriptionStatus,
      });
      errorReporter.setUserId(me.id);
    } else if (!isAuthenticated) {
      analytics.setUserId(null);
      errorReporter.setUserId(null);
    }
  }, [isAuthenticated, me, analytics, errorReporter]);
};
