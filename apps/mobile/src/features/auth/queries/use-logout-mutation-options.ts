import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAnalytics,
  useAuthService,
  useLogger,
  useNotificationService,
} from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';

import { AUTH_LOG_EVENT } from '../constants/auth-log-events';

export const useLogoutMutationOptions = () => {
  const authService = useAuthService();
  const analytics = useAnalytics();
  const { trackEvent } = useTrack();
  const notificationService = useNotificationService();
  const logger = useLogger();

  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: async () => {
      try {
        const unregisterResult = await notificationService.unregisterPushToken();
        if (!unregisterResult.ok) {
          logger.warn(AUTH_LOG_EVENT.PUSH_UNREGISTER_SKIPPED, {
            error: unregisterResult.error,
          });
        }
      } catch (error) {
        // Silently fail - continue with logout
        logger.warn(AUTH_LOG_EVENT.PUSH_UNREGISTER_FAILED, { error });
      }

      const result = await authService.logout();
      if (!result.ok) {
        logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { error: result.error });
      }
    },
    onError: () => {
      notifyError();
    },
    // API 성공/실패 관계없이 항상 로그아웃 처리
    // 캐시 정리는 상태 소유자(AuthProvider)가 미인증 전환 후에 수행한다.
    onSettled: () => {
      trackEvent('auth_logout');
      analytics.setUserId(null);
      setStatus('unauthenticated');
    },
  });
};
