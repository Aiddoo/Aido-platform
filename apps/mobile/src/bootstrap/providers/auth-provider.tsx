import { subscribeSessionExpired } from '@src/core/events/session-expired';
import { sessionExpiredSeverity } from '@src/core/ports/telemetry-event';
import { track } from '@src/shared/analytics';
import { resetAuthClient } from '@src/shared/infra/http/auth-client';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { resolveInitialAuthStatus } from './auth-boot';
import { useAnalytics, useErrorReporter, useStorage, useTokenRefresher } from './di-provider';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  setStatus: (status: AuthStatus) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const storage = useStorage();
  const tokenRefresher = useTokenRefresher();
  const errorReporter = useErrorReporter();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const [status, setStatusState] = useState<AuthStatus>('loading');

  // 앱 시작 시 초기 인증 상태 결정 (낙관적 부팅 — 토큰 선제 삭제 금지, auth-boot.ts 참조)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const initialStatus = await resolveInitialAuthStatus(
          storage,
          mmkvSyncStorage,
          tokenRefresher,
        );
        setStatusState(initialStatus);
      } catch (error) {
        // 키체인 접근 실패(기기 잠김 등)로 throw되어도 'loading'에 영구히 갇히지 않도록
        // 미인증으로 폴백하고 관측 리포팅한다.
        errorReporter.captureException(error instanceof Error ? error : new Error(String(error)), {
          feature: 'auth',
        });
        setStatusState('unauthenticated');
      }
    };
    checkAuth();
  }, [storage, tokenRefresher, errorReporter]);

  // 토큰 갱신 최종 실패(세션 만료 확정) 시 로그아웃과 동일한 순서로 정리 + 관측 리포팅
  useEffect(() => {
    return subscribeSessionExpired((reason) => {
      const severity = sessionExpiredSeverity[reason];
      // 검색가능 1급 이벤트(원인 진단용) + 집계 이벤트(빈도 파악용, 타입 카탈로그 경유)
      errorReporter.captureMessage('session_expired', {
        feature: 'auth',
        severity,
        errorCode: reason,
      });
      track(analytics, 'session_expired', { reason });

      setStatusState('unauthenticated');
      queryClient.clear();
      resetAuthClient();
    });
  }, [queryClient, errorReporter, analytics]);

  const setStatus = useCallback((newStatus: AuthStatus) => {
    setStatusState(newStatus);
  }, []);

  return <AuthContext.Provider value={{ status, setStatus }}>{children}</AuthContext.Provider>;
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
