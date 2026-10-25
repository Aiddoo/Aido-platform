import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAnalytics,
  useDraftService,
  useErrorReporter,
} from '@src/bootstrap/providers/di-context';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

export const useUserIdentity = (): void => {
  const { status } = useAuth();
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const draftService = useDraftService();
  const isAuthenticated = status === 'authenticated';

  const { data: me } = useQuery({
    ...useGetMeQueryOptions(),
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

  const meId = me?.id;
  useEffect(() => {
    if (isAuthenticated && meId != null) {
      draftService.removeAllExceptOwner(meId);
    }
  }, [isAuthenticated, meId, draftService]);
};
