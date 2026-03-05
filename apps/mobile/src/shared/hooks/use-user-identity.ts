import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAnalytics, useErrorReporter } from '@src/bootstrap/providers/di-provider';
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
    if (isAuthenticated && me?.id) {
      analytics.setUserId(me.id);
      errorReporter.setUserId(me.id);
    } else if (!isAuthenticated) {
      analytics.setUserId(null);
      errorReporter.setUserId(null);
    }
  }, [isAuthenticated, me?.id, analytics, errorReporter]);
};
