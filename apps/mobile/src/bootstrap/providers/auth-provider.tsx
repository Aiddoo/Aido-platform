import { subscribeSessionExpired } from '@src/core/events/session-expired';
import { sessionExpiredSeverity } from '@src/core/ports/telemetry-event';
import {
  useWidgetSnapshotSync,
  type WidgetSyncAuthState,
} from '@src/features/widget/presentations/hooks/use-widget-snapshot-sync';
import { track } from '@src/shared/analytics';
import { toError } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { type ResolvedAuthStatus, resolveInitialAuthStatus } from './auth-boot';
// di-context에서 직접 가져온다 — di-provider를 경유하면 벤더 초기화 모듈까지 끌려온다.
import { useAnalytics, useErrorReporter, useTokenStore } from './di-context';

/**
 * 인증 상태 머신 = 아직 판정 전(`loading`) 또는 판정 결과(`ResolvedAuthStatus`).
 *
 * `loading`만 여기 따로 있는 이유: 부팅 판정 함수는 이 값을 반환할 수 없다.
 * 판정 결과가 아니라 결과가 아직 도착하지 않았다는 UI 사정이기 때문이다.
 */
type AuthStatus = 'loading' | ResolvedAuthStatus;

interface AuthContextValue {
  status: AuthStatus;
  setStatus: (status: AuthStatus) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const tokenStore = useTokenStore();
  const errorReporter = useErrorReporter();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();

  const [status, setStatusState] = useState<AuthStatus>('loading');

  // 세션 만료 이벤트는 React 커밋 전에 도착할 수 있다. 중복 처리를 막으려면
  // state가 아니라 동기적으로 갱신되는 ref로 "지금 세션이 살아있는가"를 판정해야 한다.
  const statusRef = useRef<AuthStatus>('loading');
  const applyStatus = useCallback((next: AuthStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  /**
   * 판정 실패를 관측하고 미인증으로 폴백한다.
   *
   * `locked`는 잠금 해제를 기다리는 상태다. 잠금이 아닌 영구 오류(키체인 손상 등)까지
   * `locked`로 두면 재판정도 계속 실패해 **조용히 무한 로딩**에 갇힌다.
   * 미인증 폴백은 토큰을 지우지 않으므로, 원인이 해소되면 다음 실행에 회복된다.
   */
  const fallbackToUnauthenticated = useCallback(
    (error: unknown) => {
      errorReporter.captureException(toError(error), { feature: 'auth' });
      applyStatus('unauthenticated');
    },
    [errorReporter, applyStatus],
  );

  // 앱 시작 시 초기 인증 상태 결정 (읽기만 한다 — auth-boot.ts의 불변식 참조)
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const initialStatus = await resolveInitialAuthStatus(tokenStore);
        if (!cancelled) {
          applyStatus(initialStatus);
        }
      } catch (error) {
        if (!cancelled) {
          fallbackToUnauthenticated(error);
        }
      }
    };
    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [tokenStore, applyStatus, fallbackToUnauthenticated]);

  // 잠긴 키체인으로 판정을 미뤘다면, 잠금 해제(포그라운드 복귀) 후 다시 시도한다.
  // 이 재판정이 없으면 잠금 중 콜드 스타트가 영구 로그인 화면이 된다.
  useEffect(() => {
    if (status !== 'locked') {
      return;
    }

    const subscription = AppState.addEventListener('change', async (appState) => {
      if (appState !== 'active') {
        return;
      }
      try {
        applyStatus(await resolveInitialAuthStatus(tokenStore));
      } catch (error) {
        fallbackToUnauthenticated(error);
      }
    });

    return () => subscription.remove();
  }, [status, tokenStore, applyStatus, fallbackToUnauthenticated]);

  // 세션 만료 확정 → 미인증으로 전환 + 관측 리포팅.
  useEffect(() => {
    return subscribeSessionExpired(({ reason, serverErrorCode }) => {
      // 이미 로그아웃된 앱이 낸 401은 세션 만료가 아니다(로그인 화면에서도 인증 요청은 나간다).
      // 이 가드가 없으면 "로그인한 적 없는 유저의 session_expired"가 대량 발생해
      // 진짜 세션 유실을 노이즈 속에 묻는다.
      if (statusRef.current !== 'authenticated') {
        return;
      }

      applyStatus('unauthenticated');

      // 검색가능 1급 이벤트(원인 진단용) + 집계 이벤트(빈도 파악용, 타입 카탈로그 경유).
      // errorCode는 클라이언트의 결정 경로, serverErrorCode는 서버의 판정 — 별개 축이다.
      errorReporter.captureMessage('session_expired', {
        feature: 'auth',
        severity: sessionExpiredSeverity[reason],
        errorCode: reason,
        serverErrorCode,
      });
      track(analytics, 'session_expired', { reason });
    });
  }, [errorReporter, analytics, applyStatus]);

  // 홈 위젯 스냅샷 동기화 — 인증 상태를 아는 이 Provider가 유일한 통합 지점
  // (팀 규칙: 크로스커팅 리스너는 상태 주인 Provider에 통합, null-render 컴포넌트 금지)
  const widgetSyncAuthState: WidgetSyncAuthState =
    status === 'authenticated'
      ? 'authenticated'
      : status === 'unauthenticated'
        ? 'unauthenticated'
        : 'resolving';
  useWidgetSnapshotSync(widgetSyncAuthState);

  // 캐시 비우기는 **커밋 이후**여야 한다.
  //
  // 만료 리스너에서 같은 tick에 clear()하면, 아직 마운트된 인증 화면의 useSuspenseQuery들이
  // 즉시 재요청 → 토큰 없음 → 401 → 다시 만료 → clear 루프를 돈다. 그 401은 ErrorBoundary로
  // 던져져 "재시도/로그아웃" 화면을 띄운다. effect는 인증 화면이 언마운트된 뒤 실행된다.
  useEffect(() => {
    if (status === 'unauthenticated') {
      queryClient.clear();
    }
  }, [status, queryClient]);

  return (
    <AuthContext.Provider value={{ status, setStatus: applyStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const useAuthStatus = () => useAuth().status;
export const useIsAuthenticated = () => useAuth().status === 'authenticated';
/** 아직 인증 여부를 확정하지 못한 상태(부팅 중 또는 키체인 잠김). 로딩 화면을 유지한다. */
export const useIsAuthResolving = () => {
  const { status } = useAuth();
  return status === 'loading' || status === 'locked';
};
