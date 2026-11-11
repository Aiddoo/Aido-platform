import { useAppLifecycle, usePushRegistrationService } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useEffect } from 'react';

/** 끝난 세션의 기기 해제를 로그아웃 상태에서 연결될 때와 앱이 앞으로 올 때 다시 보낸다. 로그인하면 새 보고가 해제를 대신한다 */
export function usePushDeviceReleaseFlush(authStatus: AuthStatus) {
  const pushRegistrationService = usePushRegistrationService();
  const appLifecycle = useAppLifecycle();
  const isOnline = useIsOnline();
  const isSignedOut = authStatus === 'unauthenticated';

  useEffect(() => {
    if (!isSignedOut || !isOnline) {
      return;
    }
    pushRegistrationService.flushRelease();
    return appLifecycle.subscribe((state) => {
      if (state === 'active') {
        pushRegistrationService.flushRelease();
      }
    });
  }, [appLifecycle, isOnline, isSignedOut, pushRegistrationService]);
}
