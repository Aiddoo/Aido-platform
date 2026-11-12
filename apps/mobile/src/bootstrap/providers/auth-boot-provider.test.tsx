import { ok } from '@src/core/errors/result';
import { emitSessionExpired, subscribeSessionExpired } from '@src/core/events/session-expired';
import type { AppLifecycleState } from '@src/core/ports/app-lifecycle-gateway';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { useAuthSession } from '@src/features/identity/auth/hooks/use-auth-session';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { deviceTimezoneStoredValue } from '@src/features/notification/schemas/device-timezone-storage.schema';
import { createDraftKey } from '@src/shared/draft/draft.model';
import { KeychainLockedError } from '@src/shared/errors';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  type AppLifecycleGatewayStub,
  createAnalyticsStub,
  createAppLifecycleGatewayStub,
  createErrorReporterStub,
  createHttpClientStub,
  createMemorySyncStorage,
  createMemoryTokenStore,
  createTestDi,
  createTestQueryClient,
  createWidgetBridgeStub,
  respondByPath,
  type TestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { z } from 'zod';

import {
  createQueryCacheStorage,
  QUERY_CACHE_STORAGE_KEY,
  type QueryCacheStorage,
} from '../query/query-cache-persistence';
import { AuthBootProvider } from './auth-boot-provider';

const PUSH_RELEASE_PATH = 'v1/notifications/push-devices/unregister';
const SEOUL_TIMEZONE_RECORD = {
  userId: 'user-1',
  deviceTimezone: { timeZone: 'Asia/Seoul', offsetMinutes: 540 },
};

const StatusProbe = () => <Text testID="status">{useAuthStatus()}</Text>;

const LogoutProbe = () => {
  const { signOut } = useAuthSession();
  return (
    <Text testID="logout" onPress={signOut}>
      Logout
    </Text>
  );
};

describe('AuthBootProvider', () => {
  setupFakeTimersPerTest();

  let tokenStore: ReturnType<typeof createMemoryTokenStore>;
  let errorReporter: jest.Mocked<ErrorReporter>;
  let analytics: ReturnType<typeof createAnalyticsStub>;
  // 키체인이 잠긴 채 시작한 앱은 뒤에 있다가 잠금을 풀면 앞으로 온다
  let appLifecycle: AppLifecycleGatewayStub;
  let queryClient: QueryClient;
  let queryCacheStorage: QueryCacheStorage;
  let deviceStorage: ReturnType<typeof createMemorySyncStorage>;
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let widgetBridge: ReturnType<typeof createWidgetBridgeStub>;
  let di: TestDi;
  let unsubscribes: Array<() => void>;
  let mountedProviders: Array<Awaited<ReturnType<typeof renderScreen>>>;
  let requestRefresh: jest.Mock<Promise<Response>, [string]>;

  beforeEach(() => {
    requestRefresh = jest.fn();
    tokenStore = createMemoryTokenStore();
    errorReporter = createErrorReporterStub();
    analytics = createAnalyticsStub();
    appLifecycle = createAppLifecycleGatewayStub('background');
    queryClient = createTestQueryClient();
    queryCacheStorage = createQueryCacheStorage(createMemorySyncStorage());
    deviceStorage = createMemorySyncStorage();
    widgetBridge = createWidgetBridgeStub();
    // 부팅이 읽는 내 정보만 응답한다. 위젯 동기화의 할 일 조회 같은 다른 요청은 실패한다
    httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(respondByPath({ 'v1/auth/me': ok(createCurrentUserDto()) }));
    di = createTestDi({
      ports: {
        httpClient,
        appLifecycle,
        tokenStore,
        errorReporter,
        analytics,
        widgetBridge,
        requestRefresh,
        queryClient,
        queryCacheStorage,
        syncStorage: deviceStorage,
      },
    });
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
    await queryClient.cancelQueries();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  const renderProvider = async () => {
    const mountedProvider = await renderScreen(
      <AuthBootProvider>
        <StatusProbe />
        <LogoutProbe />
      </AuthBootProvider>,
      { di, withLocalDate: true },
    );
    mountedProviders.push(mountedProvider);
    return mountedProvider;
  };

  /** 서버에 알리지 못한 푸시 등록을 토큰으로 푸는 요청 */
  const pushReleaseRequests = () =>
    httpClient.post.mock.calls.filter(([url]) => url === PUSH_RELEASE_PATH);

  const expectStatus = (status: string) =>
    waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent(status));

  describe('부팅 판정', () => {
    it('리프레시 토큰이 있으면 인증 상태로 시작한다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');

      // When
      await renderProvider();

      // Then
      await expectStatus('authenticated');
    });

    it('기기 잠금으로 읽지 못하면 locked이며 로그인 화면으로 내려보내지 않는다', async () => {
      // Given — 기기 잠금 중 콜드 스타트
      tokenStore.getRefreshToken.mockRejectedValue(
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
      tokenStore.getRefreshToken.mockRejectedValue(new KeychainLockedError(new Error('locked')));

      // When
      await renderProvider();
      await expectStatus('locked');

      // Then
      expect(errorReporter.captureException).not.toHaveBeenCalled();
    });

    it('잠금이 아닌 판정 실패는 리포팅하고 미인증으로 폴백한다 (무한 로딩 금지)', async () => {
      // Given — 키체인 손상 등 영구 오류. locked로 두면 재판정도 실패해 앱이 조용히 갇힌다.
      tokenStore.getRefreshToken.mockRejectedValue(new Error('Could not decrypt the value'));

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
      tokenStore.getRefreshToken.mockRejectedValue({ message: 'native bridge failure' });

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
      tokenStore.getRefreshToken.mockRejectedValue(new Error('boom'));

      // When
      await renderProvider();
      await expectStatus('unauthenticated');

      // Then
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });
  });

  describe('부팅 불변식', () => {
    it('미인증으로 부팅해도 캐시를 비우고 초안은 남긴다', async () => {
      // Given
      const draftKey = createDraftKey({
        ownerId: 'user-1',
        scope: 'memo',
        target: ['create'],
        schema: z.object({ content: z.string() }),
      });
      di.draftService.save(draftKey, { content: '작성 중' });
      const clearSpy = jest.spyOn(queryClient, 'clear');
      tokenStore.getRefreshToken.mockResolvedValue(null);

      // When
      await renderProvider();

      // Then
      await expectStatus('unauthenticated');
      expect(clearSpy).toHaveBeenCalled();
      expect(di.draftService.restore(draftKey)).toEqual({
        status: 'restored',
        value: { content: '작성 중' },
      });
      expect(pushReleaseRequests()).toEqual([]);
    });

    it('어떤 판정이든 토큰을 쓰거나 지우지 않는다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');

      // When
      await renderProvider();

      // Then
      await expectStatus('authenticated');
      expect(tokenStore.save).not.toHaveBeenCalled();
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });

    it('해제할 세션이 없으면 시작할 때 갱신 요청을 보내지 않는다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');

      // When
      await renderProvider();

      // Then
      await expectStatus('authenticated');
      expect(requestRefresh).not.toHaveBeenCalled();
    });
  });

  describe('위젯 상태', () => {
    it('잠금으로 판정을 미룬 동안에는 위젯을 로그아웃으로 덮어쓰지 않는다', async () => {
      // Given
      tokenStore.getRefreshToken.mockRejectedValue(new KeychainLockedError(new Error('locked')));

      // When
      await renderProvider();

      // Then
      await expectStatus('locked');
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
      expect(widgetBridge.writeSnapshot).not.toHaveBeenCalled();
    });

    it('판정이 끝나기 전에는 위젯을 로그아웃으로 덮어쓰지 않는다', async () => {
      // Given
      tokenStore.getRefreshToken.mockReturnValue(new Promise(() => undefined));

      // When
      await renderProvider();
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });

      // Then
      await expectStatus('loading');
      expect(widgetBridge.writeSnapshot).not.toHaveBeenCalled();
    });

    it('미인증으로 확정되면 위젯을 로그아웃 상태로 쓴다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue(null);

      // When
      await renderProvider();

      // Then
      await expectStatus('unauthenticated');
      await waitFor(() => expect(widgetBridge.writeSnapshot).toHaveBeenCalled());
    });
  });

  describe('잠금 해제 재판정', () => {
    function captureAppStateListeners() {
      return (appState: AppLifecycleState) =>
        act(async () => {
          appLifecycle.emit(appState);
          await jest.advanceTimersByTimeAsync(0);
        });
    }

    it.each([
      ['토큰이 있으면', 'valid-refresh-token', 'authenticated'],
      ['토큰이 없으면', null, 'unauthenticated'],
    ])('포그라운드로 돌아와 %s 그 결과로 판정한다', async (_name, refreshToken, expected) => {
      // Given
      const changeAppState = captureAppStateListeners();
      tokenStore.getRefreshToken
        .mockRejectedValueOnce(new KeychainLockedError(new Error('locked')))
        .mockResolvedValueOnce(refreshToken);
      await renderProvider();
      await expectStatus('locked');

      // When
      await changeAppState('active');

      // Then
      await expectStatus(expected);
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });

    it('포그라운드가 아닌 상태 변화에서는 다시 읽지 않는다', async () => {
      // Given
      const changeAppState = captureAppStateListeners();
      tokenStore.getRefreshToken.mockRejectedValue(new KeychainLockedError(new Error('locked')));
      await renderProvider();
      await expectStatus('locked');

      // When
      await changeAppState('background');
      await changeAppState('inactive');

      // Then
      expect(tokenStore.getRefreshToken).toHaveBeenCalledTimes(1);
      await expectStatus('locked');
    });

    it('돌아왔는데 아직 잠겨 있으면 locked로 남고 다음 복귀에 다시 판정한다', async () => {
      // Given
      const changeAppState = captureAppStateListeners();
      tokenStore.getRefreshToken
        .mockRejectedValueOnce(new KeychainLockedError(new Error('locked')))
        .mockRejectedValueOnce(new KeychainLockedError(new Error('locked')))
        .mockResolvedValueOnce('valid-refresh-token');
      await renderProvider();
      await expectStatus('locked');

      // When
      await changeAppState('active');
      await expectStatus('locked');
      await changeAppState('background');
      await changeAppState('active');

      // Then
      await expectStatus('authenticated');
      expect(errorReporter.captureException).not.toHaveBeenCalled();
    });

    it('재판정이 영구 오류면 리포팅하고 미인증으로 내려가되 토큰은 지우지 않는다', async () => {
      // Given
      const changeAppState = captureAppStateListeners();
      tokenStore.getRefreshToken
        .mockRejectedValueOnce(new KeychainLockedError(new Error('locked')))
        .mockRejectedValueOnce(new Error('Could not decrypt the value'));
      await renderProvider();
      await expectStatus('locked');

      // When
      await changeAppState('active');

      // Then
      await expectStatus('unauthenticated');
      expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });

    it('이미 판정이 끝난 뒤의 포그라운드 복귀는 토큰을 다시 읽지 않는다', async () => {
      // Given
      const changeAppState = captureAppStateListeners();
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');
      await renderProvider();
      await expectStatus('authenticated');

      // When
      await changeAppState('active');

      // Then
      expect(tokenStore.getRefreshToken).toHaveBeenCalledTimes(1);
    });

    it.each(['success', 'failure'] as const)(
      '로그아웃 후 늦게 끝난 %s 판정은 세션을 변경하거나 리포팅하지 않는다',
      async (outcome) => {
        // Given
        const pendingRead = Promise.withResolvers<string | null>();
        tokenStore.getRefreshToken
          .mockRejectedValueOnce(new KeychainLockedError(new Error('locked')))
          .mockReturnValueOnce(pendingRead.promise);
        await renderProvider();
        await expectStatus('locked');

        await act(() => {
          appLifecycle.emit('active');
        });
        expect(tokenStore.getRefreshToken).toHaveBeenCalledTimes(2);
        await fireEvent.press(screen.getByTestId('logout'));
        await expectStatus('unauthenticated');

        // When
        await act(() => {
          if (outcome === 'success') {
            pendingRead.resolve('previous-session-token');
          } else {
            pendingRead.reject(new Error('late keychain failure'));
          }
        });

        // Then
        await expectStatus('unauthenticated');
        expect(errorReporter.captureException).not.toHaveBeenCalled();
      },
    );
  });

  describe('세션 만료 처리', () => {
    it('인증 상태에서 만료되면 미인증으로 내려가고 1회 리포팅한다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');
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
      tokenStore.getRefreshToken.mockResolvedValue(null);
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
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');
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
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');
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

    it('로그아웃하면 다음 사용자가 보지 못하도록 작성 중 초안을 모두 지운다', async () => {
      // Given
      const draftKey = createDraftKey({
        ownerId: 'user-1',
        scope: 'memo',
        target: ['create'],
        schema: z.object({ content: z.string() }),
      });
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');
      await renderProvider();
      await expectStatus('authenticated');
      di.draftService.save(draftKey, { content: '작성 중' });

      // When
      await fireEvent.press(screen.getByTestId('logout'));

      // Then
      await expectStatus('unauthenticated');
      expect(di.draftService.restore(draftKey)).toEqual({ status: 'empty' });
    });

    it('로그아웃하면 마지막 기기 시간대를 지운다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');
      await renderProvider();
      await expectStatus('authenticated');
      writeStoredValue(deviceStorage, deviceTimezoneStoredValue, SEOUL_TIMEZONE_RECORD);

      // When
      await fireEvent.press(screen.getByTestId('logout'));

      // Then
      await expectStatus('unauthenticated');
      expect(readStoredValue(deviceStorage, deviceTimezoneStoredValue)).toBeNull();
    });

    it.each(['refresh-rejected', 'tokens-missing'] as const)(
      '세션이 만료되면(%s) 서버에 알리지 못한 이 기기의 푸시 등록 해제를 요청한다',
      async (reason) => {
        // Given
        tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');
        await renderProvider();
        await expectStatus('authenticated');

        // When
        await act(() => emitSessionExpired({ reason }));

        // Then
        await expectStatus('unauthenticated');
        await waitFor(() => expect(pushReleaseRequests()).toHaveLength(1));
      },
    );

    it('세션이 만료되면 마지막 기기 시간대를 남겨 같은 사용자가 다시 로그인해도 변경을 알아챈다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');
      await renderProvider();
      await expectStatus('authenticated');
      writeStoredValue(deviceStorage, deviceTimezoneStoredValue, SEOUL_TIMEZONE_RECORD);

      // When
      await act(() => emitSessionExpired({ reason: 'tokens-missing' }));

      // Then
      await expectStatus('unauthenticated');
      expect(readStoredValue(deviceStorage, deviceTimezoneStoredValue)).toEqual(
        SEOUL_TIMEZONE_RECORD,
      );
    });

    it('로그아웃하면 기기에 저장한 조회 캐시를 지워 다음 사용자에게 복원되지 않게 한다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');
      await renderProvider();
      await expectStatus('authenticated');
      queryCacheStorage.setOwner('user-1');
      queryCacheStorage.setItem(QUERY_CACHE_STORAGE_KEY, '내 캐시');

      // When
      await fireEvent.press(screen.getByTestId('logout'));

      // Then
      await expectStatus('unauthenticated');
      expect(queryCacheStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
      queryCacheStorage.setItem(QUERY_CACHE_STORAGE_KEY, '주인 없는 캐시');
      expect(queryCacheStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    });

    it('세션이 만료되어도 작성 중 초안은 남겨 같은 사용자가 다시 로그인하면 이어 쓰게 한다', async () => {
      // Given
      const draftKey = createDraftKey({
        ownerId: 'user-1',
        scope: 'memo',
        target: ['create'],
        schema: z.object({ content: z.string() }),
      });
      tokenStore.getRefreshToken.mockResolvedValue('valid-refresh-token');
      await renderProvider();
      await expectStatus('authenticated');
      di.draftService.save(draftKey, { content: '작성 중' });

      // When
      await act(() => emitSessionExpired({ reason: 'refresh-rejected' }));

      // Then
      await expectStatus('unauthenticated');
      expect(di.draftService.restore(draftKey)).toEqual({
        status: 'restored',
        value: { content: '작성 중' },
      });
    });
  });
});
