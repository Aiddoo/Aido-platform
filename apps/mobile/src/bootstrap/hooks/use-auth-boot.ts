import { subscribeSessionExpired } from '@src/core/events/session-expired';
import { ERROR_REPORT_MESSAGES } from '@src/core/observability/telemetry-keys';
import { sessionExpiredSeverity } from '@src/core/ports/telemetry-event';
import { isAuthBootPending } from '@src/features/identity/auth/domains/auth-session.model';
import { track } from '@src/shared/analytics';
import { toError } from '@src/shared/errors';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { resolveInitialAuthStatus } from '../providers/auth-boot';
// di-context에서 직접 가져온다 — di-provider를 경유하면 벤더 초기화 모듈까지 끌려온다.
import {
  useAnalytics,
  useAuthSessionStore,
  useErrorReporter,
  useSessionCleanupService,
  useTokenStore,
} from '../providers/di-context';

/**
 * 시작 판정, 잠금 해제 재판정, 세션 만료 구독, 커밋 뒤 정리를 맡는다.
 * `AuthGateLayout`에 두면 `QueryErrorBoundary` 아래라 오류 화면에서 만료 구독이 끊긴다.
 */
export function useAuthBoot(): void {
  const authSessionStore = useAuthSessionStore();
  const tokenStore = useTokenStore();
  const errorReporter = useErrorReporter();
  const analytics = useAnalytics();
  const sessionCleanupService = useSessionCleanupService();
  const authSession = useSyncExternalStore(authSessionStore.subscribe, authSessionStore.getState);
  const { status } = authSession;

  /**
   * 토큰을 읽어 판정한다. 판정이 끝났으면(로그아웃 등) 결과를 버린다.
   *
   * `locked`는 잠금 해제를 기다리는 상태다. 잠금이 아닌 영구 오류(키체인 손상 등)까지
   * `locked`로 두면 재판정도 계속 실패해 **조용히 무한 로딩**에 갇힌다.
   * 미인증 폴백은 토큰을 지우지 않으므로, 원인이 해소되면 다음 실행에 회복된다.
   */
  const resolveBoot = useCallback(
    async (isCancelled: () => boolean) => {
      const isStale = () => isCancelled() || !isAuthBootPending(authSessionStore.getState());
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

  // 앱 시작 시 초기 인증 상태 결정 (읽기만 한다 — auth-boot.ts의 불변식 참조)
  useEffect(() => {
    let cancelled = false;
    resolveBoot(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [resolveBoot]);

  // 잠긴 키체인으로 판정을 미뤘다면, 잠금 해제(포그라운드 복귀) 후 다시 시도한다.
  // 이 재판정이 없으면 잠금 중 콜드 스타트가 영구 로그인 화면이 된다.
  useEffect(() => {
    if (status !== 'locked') {
      return;
    }

    let cancelled = false;
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        resolveBoot(() => cancelled);
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [status, resolveBoot]);

  useEffect(() => {
    return subscribeSessionExpired(({ reason, serverErrorCode }) => {
      // 이미 로그아웃된 앱이 낸 401은 세션 만료가 아니다(로그인 화면에서도 인증 요청은 나간다).
      // 이 가드가 없으면 "로그인한 적 없는 유저의 session_expired"가 대량 발생해
      // 진짜 세션 유실을 노이즈 속에 묻는다.
      if (authSessionStore.getState().status !== 'authenticated') {
        return;
      }

      authSessionStore.dispatch({ type: 'sessionExpired' });

      // 검색가능 1급 이벤트(원인 진단용) + 집계 이벤트(빈도 파악용, 타입 카탈로그 경유).
      // errorCode는 클라이언트의 결정 경로, serverErrorCode는 서버의 판정 — 별개 축이다.
      errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SESSION_EXPIRED, {
        feature: 'auth',
        severity: sessionExpiredSeverity[reason],
        errorCode: reason,
        serverErrorCode,
      });
      track(analytics, 'session_expired', { reason });
    });
  }, [authSessionStore, errorReporter, analytics]);

  // 캐시 비우기는 **커밋 이후**여야 한다.
  //
  // 만료 리스너에서 같은 tick에 clear()하면, 아직 마운트된 인증 화면의 useSuspenseQuery들이
  // 즉시 재요청 → 토큰 없음 → 401 → 다시 만료 → clear 루프를 돈다. 그 401은 ErrorBoundary로
  // 던져져 "재시도/로그아웃" 화면을 띄운다. effect는 인증 화면이 언마운트된 뒤 실행된다.
  useEffect(() => {
    if (authSession.status !== 'unauthenticated') {
      return;
    }
    if (authSession.reason === 'signed-out') {
      sessionCleanupService.afterSignedOut();
    } else {
      sessionCleanupService.afterSessionEnded();
    }
  }, [authSession, sessionCleanupService]);
}
