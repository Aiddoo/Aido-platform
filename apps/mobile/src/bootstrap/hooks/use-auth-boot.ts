import { subscribeSessionExpired } from '@src/core/events/session-expired';
import { sessionExpiredSeverity } from '@src/core/observability/telemetry-event';
import { ERROR_REPORT_MESSAGES } from '@src/core/observability/telemetry-keys';
import { AuthSessionPolicy } from '@src/features/identity/auth/domains/auth-session.model';
import { track } from '@src/shared/analytics';
import { toError } from '@src/shared/errors';
import { useOnAppForeground } from '@src/shared/hooks/use-on-app-foreground';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { match } from 'ts-pattern';

import { resolveInitialAuthStatus } from '../auth/resolve-initial-auth-status';
// di-context에서 직접 가져온다 — di-provider를 경유하면 벤더 초기화 모듈까지 끌려온다.
import {
  useAnalytics,
  useAuthSessionStore,
  useErrorReporter,
  useSessionCleanupService,
  useTokenStore,
} from '../providers/di-context';

/** `AuthGateLayout`에 두면 `QueryErrorBoundary` 아래라 오류 화면에서 만료 구독이 끊긴다 */
export function useAuthBoot(): void {
  const authSessionStore = useAuthSessionStore();
  const tokenStore = useTokenStore();
  const errorReporter = useErrorReporter();
  const analytics = useAnalytics();
  const sessionCleanupService = useSessionCleanupService();
  const authSession = useSyncExternalStore(authSessionStore.subscribe, authSessionStore.getState);

  /** `locked`는 잠금 해제를 기다리는 상태다. 잠금이 아닌 영구 오류까지 `locked`로 두면 재판정도 계속 실패해 조용히 무한 로딩에 갇힌다 */
  const resolveBoot = useCallback(
    async (isCancelled: () => boolean) => {
      const isStale = () =>
        isCancelled() || !AuthSessionPolicy.isAuthBootPending(authSessionStore.getState());
      try {
        const resolved = await resolveInitialAuthStatus(tokenStore);
        if (!isStale()) {
          authSessionStore.dispatch({ type: 'bootResolved', status: resolved });
        }
      } catch (error) {
        if (!isStale()) {
          errorReporter.captureException(toError(error), { feature: 'auth' });
          authSessionStore.dispatch({ type: 'bootFailed' });
        }
      }
    },
    [authSessionStore, tokenStore, errorReporter],
  );

  useEffect(() => {
    let cancelled = false;
    resolveBoot(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [resolveBoot]);

  // 잠긴 키체인으로 판정을 미뤘다면, 잠금 해제(포그라운드 복귀) 후 다시 시도한다.
  // 이 재판정이 없으면 잠금 중 콜드 스타트가 영구 로그인 화면이 된다.
  useOnAppForeground(() => {
    const isLocked = () => authSessionStore.getState().status === 'locked';
    if (isLocked()) {
      resolveBoot(() => !isLocked());
    }
  });

  useEffect(() => {
    return subscribeSessionExpired(({ reason, serverErrorCode }) => {
      // 로그아웃된 앱이 낸 401은 세션 만료가 아니다. 가드가 없으면 로그인한 적 없는 유저의 session_expired가 대량 발생해 진짜 세션 유실이 묻힌다
      if (authSessionStore.getState().status !== 'authenticated') {
        return;
      }

      authSessionStore.dispatch({ type: 'sessionExpired' });

      // errorCode는 클라이언트의 결정 경로, serverErrorCode는 서버의 판정으로 별개 축이다
      errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SESSION_EXPIRED, {
        feature: 'auth',
        severity: sessionExpiredSeverity[reason],
        errorCode: reason,
        serverErrorCode,
      });
      track(analytics, 'session_expired', { reason });
    });
  }, [authSessionStore, errorReporter, analytics]);

  // 캐시 비우기는 커밋 이후여야 한다. 만료 리스너에서 같은 tick에 clear()하면 마운트된 인증 화면의 useSuspenseQuery가 재요청 → 401 → 다시 만료 루프를 돈다
  useEffect(() => {
    if (authSession.status !== 'unauthenticated') {
      return;
    }
    match(authSession.reason)
      .with('signed-out', () => sessionCleanupService.afterSignedOut())
      .with('expired', () => sessionCleanupService.afterSessionExpired())
      .with('none', 'boot-failed', () => sessionCleanupService.afterSessionEnded())
      .exhaustive();
  }, [authSession, sessionCleanupService]);
}
