import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAnalytics,
  useAuthService,
  useHaptics,
  useLogger,
  usePushDeviceService,
} from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { mutationOptions, onlineManager } from '@tanstack/react-query';

import { logOutDevice } from '../utils/log-out-device';

export const useLogoutMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const analytics = useAnalytics();
  const { trackEvent } = useTrack();
  const pushDeviceService = usePushDeviceService();
  const logger = useLogger();

  const { setStatus } = useAuth();

  return mutationOptions({
    // 오프라인에서도 멈추지 않고 바로 이 기기의 세션을 끝낸다
    networkMode: 'always',
    mutationFn: () =>
      logOutDevice({
        isOnline: onlineManager.isOnline(),
        authService,
        pushDeviceService,
        logger,
      }),
    onError: () => {
      haptics.notify('error');
    },
    // 캐시 정리는 상태 소유자(AuthProvider)가 미인증 전환 후에 수행한다.
    onSettled: () => {
      trackEvent('auth_logout');
      analytics.setUserId(null);
      setStatus('unauthenticated');
    },
  });
};
