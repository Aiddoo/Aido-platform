import { emitSessionExpired, subscribeSessionExpired } from '@src/core/events/session-expired';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { TodoService } from '@src/features/todo/services/todo.service';
import { WidgetSyncService } from '@src/features/widget/services/widget-sync.service';
import {
  createMockAnalytics,
  createMockDIContainer,
  createMockHttpClient,
  createMockTokenStore,
} from '@src/shared/__tests__';
import { KeychainLockedError } from '@src/shared/errors';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
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
  let mountedProviders: Array<Awaited<ReturnType<typeof render>>>;

  beforeEach(() => {
    jest.useFakeTimers();
    tokenStore = createMockTokenStore();
    errorReporter = createMockErrorReporter();
    analytics = createMockAnalytics();
    queryClient = new QueryClient();
    unsubscribes = [];
    mountedProviders = [];
  });

  afterEach(async () => {
    for (const mountedProvider of mountedProviders) {
      await mountedProvider.unmount();
    }
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const renderProvider = async () => {
    // AuthProvider가 마운트하는 위젯 동기화 훅의 의존성 — 네트워크/브리지는 전부 mock
    const todoService = new TodoService(createMockHttpClient());
    const widgetSyncService = new WidgetSyncService(
      { writeSnapshot: jest.fn().mockResolvedValue(undefined) },
      errorReporter,
    );

    const mountedProvider = await render(
      <StaticDIProvider
        container={createMockDIContainer({
          tokenStore,
          errorReporter,
          analytics,
          todoService,
          widgetSyncService,
        })}
      >
        <QueryClientProvider client={queryClient}>
          <LocalDateProvider>
            <AuthProvider>
              <StatusProbe />
            </AuthProvider>
          </LocalDateProvider>
        </QueryClientProvider>
      </StaticDIProvider>,
    );
    mountedProviders.push(mountedProvider);
    return mountedProvider;
  };

  const expectStatus = (status: string) =>
    waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent(status));

  describe('부팅 판정', () => {
    it('리프레시 토큰이 있으면 인증 상태로 시작한다', async () => {
      // Given
      tokenStore.readRefreshToken.mockResolvedValue('valid-refresh-token');

      // When
      await renderProvider();

      // Then
      await expectStatus('authenticated');
    });

    it('기기 잠금으로 읽지 못하면 locked이며 로그인 화면으로 내려보내지 않는다', async () => {
      // Given — 기기 잠금 중 콜드 스타트
      tokenStore.readRefreshToken.mockRejectedValue(
        new KeychainLockedError(new Error('User interaction is not allowed.')),
      );

      // When
      await renderProvider();

      // Then
      await expectStatus('locked');
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });

    it('locked 상태에서는 리포팅하지 않는다 (잠금은 오류가 아니라 대기다)', async () => {
      // Given
      tokenStore.readRefreshToken.mockRejectedValue(new KeychainLockedError(new Error('locked')));

      // When
      await renderProvider();
      await expectStatus('locked');

      // Then
      expect(errorReporter.captureException).not.toHaveBeenCalled();
    });

    it('잠금이 아닌 판정 실패는 리포팅하고 미인증으로 폴백한다 (무한 로딩 금지)', async () => {
      // Given — 키체인 손상 등 영구 오류. locked로 두면 재판정도 실패해 앱이 조용히 갇힌다.
      tokenStore.readRefreshToken.mockRejectedValue(new Error('Could not decrypt the value'));

      // When
      await renderProvider();

      // Then
      await expectStatus('unauthenticated');
      expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
      expect(errorReporter.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ feature: 'auth' }),
      );
    });

    it('Error가 아닌 값이 던져져도 메시지를 잃지 않고 리포팅한다', async () => {
      // Given — String(value)로 감싸면 "[object Object]"가 되어 원인을 알 수 없다
      tokenStore.readRefreshToken.mockRejectedValue({ message: 'native bridge failure' });

      // When
      await renderProvider();
      await expectStatus('unauthenticated');

      // Then — String(value)였다면 message가 "[object Object]"가 된다
      expect(errorReporter.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'native bridge failure' }),
        expect.objectContaining({ feature: 'auth' }),
      );
    });

    it('판정 실패로 폴백해도 토큰을 지우지 않는다', async () => {
      // Given — 원인이 해소되면 다음 실행에 회복되어야 한다
      tokenStore.readRefreshToken.mockRejectedValue(new Error('boom'));

      // When
      await renderProvider();
      await expectStatus('unauthenticated');

      // Then
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });
  });

  describe('세션 만료 처리', () => {
    it('인증 상태에서 만료되면 미인증으로 내려가고 1회 리포팅한다', async () => {
      // Given
      tokenStore.readRefreshToken.mockResolvedValue('valid-refresh-token');
      await renderProvider();
      await expectStatus('authenticated');

      // When
      await act(() =>
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
      await renderProvider();
      await expectStatus('unauthenticated');

      // When
      await act(() => emitSessionExpired({ reason: 'tokens-missing' }));

      // Then
      expect(errorReporter.captureMessage).not.toHaveBeenCalled();
      expect(analytics.trackEvent).not.toHaveBeenCalled();
    });

    it('만료 이벤트가 연달아 와도 한 번만 리포팅한다', async () => {
      // Given — 세션 종료 후 도착한 다른 요청들이 각자 401 → 만료를 발행한다
      tokenStore.readRefreshToken.mockResolvedValue('valid-refresh-token');
      await renderProvider();
      await expectStatus('authenticated');

      // When
      await act(() => {
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
      await renderProvider();
      await expectStatus('authenticated');

      let clearedDuringEmit = false;
      unsubscribes.push(
        subscribeSessionExpired(() => {
          clearedDuringEmit = clearSpy.mock.calls.length > 0;
        }),
      );

      // When
      await act(() =>
        emitSessionExpired({ reason: 'refresh-rejected', serverErrorCode: 'SESSION_0704' }),
      );

      // Then
      await expectStatus('unauthenticated');
      expect(clearedDuringEmit).toBe(false);
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });
});
