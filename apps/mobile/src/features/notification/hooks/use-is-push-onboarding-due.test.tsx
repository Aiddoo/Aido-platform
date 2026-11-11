import { ok } from '@src/core/errors/result';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import {
  createCurrentUserDto,
  createUser,
} from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { toInstant } from '@src/shared/date/instant';
import {
  createAppLifecycleGatewayStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createPushNotificationGatewayStub,
  createTestQueryClient,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act, waitFor } from '@testing-library/react-native';

import { NOTIFICATION_QUERY_KEYS } from '../queries/notification-query-keys';
import { useIsPushOnboardingDue } from './use-is-push-onboarding-due';

const SIGNED_UP_AT = '2026-11-08T00:00:00.000Z';
// 가입 창(1일)이 끝나기 3분 전
const NOW = Date.parse('2026-11-08T23:57:00.000Z');

async function renderGuard() {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    USER_QUERY_KEYS.me(),
    createUser({ createdAt: toInstant(SIGNED_UP_AT) }),
  );
  queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.permission(), {
    status: 'NOT_DETERMINED',
    canAskAgain: true,
  });
  const appLifecycle = createAppLifecycleGatewayStub();
  // 권한은 화면을 열 때마다 다시 읽어 기기도 아직 묻지 않은 상태로 둔다
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getPermission.mockResolvedValue({
    status: 'undetermined',
    canAskAgain: true,
    iosStatus: null,
  });
  let renderCount = 0;
  const hook = await renderScreenHook(
    () => {
      renderCount += 1;
      return useIsPushOnboardingDue();
    },
    {
      queryClient,
      di: {
        authSessionStore: createAuthSessionStoreStub('authenticated'),
        syncStorage: createMemoryObservableSyncStorage(),
        appLifecycle,
        pushNotification,
      },
    },
  );
  return { ...hook, appLifecycle, getRenderCount: () => renderCount };
}

describe('useIsPushOnboardingDue — 앱 화면 묶음 guard', () => {
  setupFakeTimersPerTest({ now: NOW });

  it('분이 바뀌어도 다시 그리지 않다가 가입 창이 끝나는 순간에 한 번 닫힌다', async () => {
    // Given
    const { result, getRenderCount } = await renderGuard();
    expect(result.current).toBe(true);
    const rendersBeforeTicks = getRenderCount();

    // When
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2 * MINUTE_MS);
    });

    // Then
    expect(result.current).toBe(true);
    expect(getRenderCount()).toBe(rendersBeforeTicks);

    // When
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MINUTE_MS);
    });

    // Then
    expect(result.current).toBe(false);
  });

  it('창이 끝나면 앱으로 돌아와도 더 다시 그리지 않는다', async () => {
    // Given
    const { result, appLifecycle, getRenderCount } = await renderGuard();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3 * MINUTE_MS);
    });
    expect(result.current).toBe(false);
    const rendersAfterWindow = getRenderCount();

    // When
    await act(async () => appLifecycle.emit('background'));
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(getRenderCount()).toBe(rendersAfterWindow);
  });
});

describe('useIsPushOnboardingDue — 알림 권한을 이미 답한 사용자', () => {
  setupFakeTimersPerTest({ now: NOW });

  it.each(['granted', 'denied'] as const)(
    '기기 권한이 %s이면 내 정보·권한을 읽기 전 첫 렌더부터 한 번도 열지 않는다',
    async (status) => {
      // Given
      const httpClient = createHttpClientStub();
      httpClient.get.mockImplementation(async () =>
        ok(createCurrentUserDto({ createdAt: SIGNED_UP_AT })),
      );
      const pushNotification = createPushNotificationGatewayStub();
      pushNotification.getPermission.mockResolvedValue({
        status,
        canAskAgain: false,
        iosStatus: null,
      });
      const renderedValues: (boolean | null)[] = [];

      // When
      const { queryClient } = await renderScreenHook(
        () => {
          const isDue = useIsPushOnboardingDue();
          renderedValues.push(isDue);
          return isDue;
        },
        {
          di: {
            httpClient,
            authSessionStore: createAuthSessionStoreStub('authenticated'),
            syncStorage: createMemoryObservableSyncStorage(),
            pushNotification,
          },
        },
      );
      await waitFor(() => {
        expect(queryClient.getQueryData(USER_QUERY_KEYS.me())).toBeDefined();
        expect(queryClient.getQueryData(NOTIFICATION_QUERY_KEYS.permission())).toBeDefined();
      });

      // Then
      await waitFor(() => expect(renderedValues.at(-1)).toBe(false));
      expect(renderedValues[0]).toBeNull();
      expect(renderedValues).not.toContain(true);
    },
  );
});
