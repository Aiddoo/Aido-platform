import { ok } from '@src/core/errors/result';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import {
  createCurrentUserDto,
  createUser,
} from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { getNowInstant } from '@src/shared/date/clock';
import { toInstant } from '@src/shared/date/instant';
import {
  createAppLifecycleGatewayStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createPushNotificationGatewayStub,
  createTestQueryClient,
  setupFakeTimersPerTest,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act, waitFor } from '@testing-library/react-native';

import { createPushPermissionResponse } from '../__tests__/notification.fixtures';
import { PUSH_PERMISSION_QUERY_KEYS } from '../queries/push-permission-query-keys';
import {
  createPushOnboardingGuardStore,
  type PushOnboardingGuardState,
} from '../stores/push-onboarding-guard.store';
import { usePushOnboardingGuard, usePushOnboardingGuardState } from './use-push-onboarding-guard';

async function renderGuardState(getPermission: () => Promise<PushPermissionResponse>) {
  const guardStore = createPushOnboardingGuardStore();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  // 방금 가입해 알림 화면을 보여 줄 수 있는 기간 안이다
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ createdAt: getNowInstant() }));
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getPermission.mockImplementation(getPermission);

  const hook = await renderScreenHook(
    () => {
      usePushOnboardingGuard();
      return usePushOnboardingGuardState();
    },
    {
      di: createTestDi({
        ports: { syncStorage: createMemoryObservableSyncStorage(), pushNotification, queryClient },
        seeds: {
          authSessionStore: createAuthSessionStoreStub('authenticated'),
          pushOnboardingGuardStore: guardStore,
        },
      }),
    },
  );
  return { ...hook, guardStore };
}

describe('usePushOnboardingGuardState — 다른 자동 화면이 기다리는 신호', () => {
  it('권한을 읽기 전에는 pending이라 다른 화면이 알림 화면보다 앞서지 않는다', async () => {
    // When
    const { result } = await renderGuardState(() => new Promise(() => undefined));

    // Then
    expect(result.current).toBe('pending');
  });

  it('새 계정이 아직 답하지 않았으면 알림 화면 차례라 open이다', async () => {
    // When
    const { result } = await renderGuardState(async () =>
      createPushPermissionResponse({ status: 'undetermined', canAskAgain: true }),
    );

    // Then
    await waitFor(() => expect(result.current).toBe('open'));
  });

  it('알림을 이미 허용했으면 closed라 다른 화면이 열릴 수 있다', async () => {
    // When
    const { result } = await renderGuardState(async () => createPushPermissionResponse());

    // Then
    await waitFor(() => expect(result.current).toBe('closed'));
  });

  it('권한을 읽지 못하면 알림 화면을 띄울 수 없으므로 closed다', async () => {
    // When
    const { result } = await renderGuardState(async () => {
      throw new Error('permission unavailable');
    });

    // Then
    await waitFor(() => expect(result.current).toBe('closed'));
  });

  it('guard가 사라지면 다시 pending이 되어 남은 판정으로 화면을 열지 않는다', async () => {
    // Given
    const { result, unmount, guardStore } = await renderGuardState(async () =>
      createPushPermissionResponse({ status: 'undetermined', canAskAgain: true }),
    );
    await waitFor(() => expect(result.current).toBe('open'));

    // When
    await unmount();

    // Then
    expect(guardStore.getSnapshot()).toBe('pending');
  });
});

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
  queryClient.setQueryData(PUSH_PERMISSION_QUERY_KEYS.current(), {
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
      return usePushOnboardingGuard();
    },
    {
      di: createTestDi({
        ports: {
          syncStorage: createMemoryObservableSyncStorage(),
          appLifecycle,
          pushNotification,
          queryClient,
        },
        seeds: { authSessionStore: createAuthSessionStoreStub('authenticated') },
      }),
    },
  );
  return { ...hook, appLifecycle, getRenderCount: () => renderCount };
}

describe('usePushOnboardingGuard — 가입 창', () => {
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

describe('usePushOnboardingGuardState — 알림 권한을 이미 답한 사용자', () => {
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
      const renderedStates: PushOnboardingGuardState[] = [];

      // When
      const { queryClient } = await renderScreenHook(
        () => {
          usePushOnboardingGuard();
          const state = usePushOnboardingGuardState();
          renderedStates.push(state);
          return state;
        },
        {
          di: createTestDi({
            ports: {
              httpClient,
              syncStorage: createMemoryObservableSyncStorage(),
              pushNotification,
            },
            seeds: { authSessionStore: createAuthSessionStoreStub('authenticated') },
          }),
        },
      );
      await waitFor(() => {
        expect(queryClient.getQueryData(USER_QUERY_KEYS.me())).toBeDefined();
        expect(queryClient.getQueryData(PUSH_PERMISSION_QUERY_KEYS.current())).toBeDefined();
      });

      // Then
      await waitFor(() => expect(renderedStates.at(-1)).toBe('closed'));
      expect(renderedStates[0]).toBe('pending');
      expect(renderedStates).not.toContain('open');
    },
  );
});
