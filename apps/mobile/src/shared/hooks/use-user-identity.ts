import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAnalytics,
  useAuthService,
  useErrorReporter,
} from '@src/bootstrap/providers/di-provider';
import { AUTH_QUERY_KEYS } from '@src/features/auth/presentations/constants/auth-query-keys.constant';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

export const useUserIdentity = (): void => {
  const { status } = useAuth();
  const authService = useAuthService();
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const isAuthenticated = status === 'authenticated';

  const { data: me } = useQuery({
    queryKey: AUTH_QUERY_KEYS.me(),
    queryFn: async () => {
      const result = await authService.getCurrentUser();
      return result.ok ? result.value : null;
    },
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
