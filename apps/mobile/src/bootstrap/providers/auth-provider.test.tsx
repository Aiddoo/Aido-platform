import { emitSessionExpired, subscribeSessionExpired } from '@src/core/events/session-expired';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import {
  createMockAnalytics,
  createMockDIContainer,
  createMockTokenStore,
} from '@src/shared/__tests__';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, useAuthStatus } from './auth-provider';
import { StaticDIProvider } from './di-context';

const createMockErrorReporter = (): jest.Mocked<ErrorReporter> => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUserId: jest.fn(),
});

const StatusProbe = () => <Text testID="status">{useAuthStatus()}</Text>;

describe('AuthProvider', () => {
  let tokenStore: ReturnType<typeof createMockTokenStore>;
  let errorReporter: jest.Mocked<ErrorReporter>;
  let analytics: ReturnType<typeof createMockAnalytics>;
  let queryClient: QueryClient;
  let unsubscribes: Array<() => void>;

  beforeEach(() => {
    tokenStore = createMockTokenStore();
    errorReporter = createMockErrorReporter();
    analytics = createMockAnalytics();
    queryClient = new QueryClient();
    unsubscribes = [];
  });

  afterEach(() => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  });

  const renderProvider = () =>
    render(
      <StaticDIProvider container={createMockDIContainer({ tokenStore, errorReporter, analytics })}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusProbe />
          </AuthProvider>
        </QueryClientProvider>
      </StaticDIProvider>,
    );

  const expectStatus = (status: string) =>
    waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent(status));

  describe('부팅 판정', () => {
    it('리프레시 토큰이 있으면 인증 상태로 시작한다', async () => {
      // Given
      tokenStore.readRefreshToken.mockResolvedValue('valid-refresh-token');

      // When
      renderProvider();

      // Then
      await expectStatus('authenticated');
    });

    it('키체인을 읽을 수 없으면 locked이며 로그인 화면으로 내려보내지 않는다', async () => {
      // Given — 기기 잠금 중 콜드 스타트
      tokenStore.readRefreshToken.mockRejectedValue(new Error('User interaction is not allowed.'));

      // When
      renderProvider();

      // Then
      await expectStatus('locked');
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });
  });

  describe('세션 만료 처리', () => {
    it('인증 상태에서 만료되면 미인증으로 내려가고 1회 리포팅한다', async () => {
      // Given
      tokenStore.readRefreshToken.mockResolvedValue('valid-refresh-token');
      renderProvider();
      await expectStatus('authenticated');

      // When
      act(() =>
        emitSessionExpired({ reason: 'refresh-rejected', serverErrorCode: 'SESSION_0704' }),
      );

      // Then
      await expectStatus('unauthenticated');
      expect(errorReporter.captureMessage).toHaveBeenCalledTimes(1);
      expect(errorReporter.captureMessage).toHaveBeenCalledWith('session_expired', {
        feature: 'auth',
        severity: 'warning',
        errorCode: 'refresh-rejected',
        serverErrorCode: 'SESSION_0704',
      });
      expect(analytics.trackEvent).toHaveBeenCalledWith('session_expired', {
        reason: 'refresh-rejected',
      });
    });

    it('이미 로그아웃된 상태의 만료 이벤트는 잡음이므로 리포팅하지 않는다', async () => {
      // Given — 로그인 화면에서도 인증 요청은 나가고 401을 받는다
      tokenStore.readRefreshToken.mockResolvedValue(null);
      renderProvider();
      await expectStatus('unauthenticated');

      // When
      act(() => emitSessionExpired({ reason: 'tokens-missing' }));

      // Then
      expect(errorReporter.captureMessage).not.toHaveBeenCalled();
      expect(analytics.trackEvent).not.toHaveBeenCalled();
    });

    it('만료 이벤트가 연달아 와도 한 번만 리포팅한다', async () => {
      // Given — 세션 종료 후 도착한 다른 요청들이 각자 401 → 만료를 발행한다
      tokenStore.readRefreshToken.mockResolvedValue('valid-refresh-token');
      renderProvider();
      await expectStatus('authenticated');

      // When
      act(() => {
        emitSessionExpired({ reason: 'refresh-rejected' });
        emitSessionExpired({ reason: 'tokens-missing' });
        emitSessionExpired({ reason: 'tokens-missing' });
      });

      // Then
      await expectStatus('unauthenticated');
      expect(errorReporter.captureMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('캐시 정리 시점', () => {
    it('만료 리스너 실행 중에는 캐시를 비우지 않고, 커밋 이후에 비운다', async () => {
      // Given — 리스너에서 곧바로 clear()하면 아직 마운트된 인증 화면의 suspense 쿼리가
      // 즉시 재요청 → 401 → 다시 만료 → ErrorBoundary("재시도/로그아웃") 루프를 돈다.
      const clearSpy = jest.spyOn(queryClient, 'clear');
      tokenStore.readRefreshToken.mockResolvedValue('valid-refresh-token');
      renderProvider();
      await expectStatus('authenticated');

      let clearedDuringEmit = false;
      unsubscribes.push(
        subscribeSessionExpired(() => {
          clearedDuringEmit = clearSpy.mock.calls.length > 0;
        }),
      );

      // When
      act(() =>
        emitSessionExpired({ reason: 'refresh-rejected', serverErrorCode: 'SESSION_0704' }),
      );

      // Then
      await expectStatus('unauthenticated');
      expect(clearedDuringEmit).toBe(false);
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });
});
