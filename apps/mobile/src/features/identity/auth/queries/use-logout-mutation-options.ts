import {
  useAnalytics,
  useAuthService,
  useHaptics,
  useLogger,
  usePushDeviceService,
  useSessionRevocationService,
  useTokenStore,
} from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { mutationOptions, onlineManager } from '@tanstack/react-query';

import { useAuthSession } from '../hooks/use-auth-session';
import { logOutDevice } from '../utils/log-out-device';

export const useLogoutMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const analytics = useAnalytics();
  const { trackEvent } = useTrack();
  const pushDeviceService = usePushDeviceService();
  const tokenStore = useTokenStore();
  const sessionRevocationService = useSessionRevocationService();
  const logger = useLogger();

  const { signOut } = useAuthSession();

  return mutationOptions({
    // 오프라인에서도 멈추지 않고 바로 이 기기의 세션을 끝낸다
    networkMode: 'always',
    mutationFn: () =>
      logOutDevice({
        isOnline: onlineManager.isOnline(),
        authService,
        pushDeviceService,
        tokenStore,
        sessionRevocationService,
        logger,
      }),
    onError: () => {
      haptics.notify('error');
    },
    // 캐시 정리는 미인증 전환이 커밋된 뒤 부팅 훅이 수행한다.
    onSettled: () => {
      trackEvent('auth_logout');
      analytics.setUserId(null);
      signOut();
    },
  });
};
