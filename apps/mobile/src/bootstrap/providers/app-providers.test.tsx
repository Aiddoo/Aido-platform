import { ok } from '@src/core/errors/result';
import { emitNotificationsChanged } from '@src/core/events/notifications-changed';
import { emitSessionExpired } from '@src/core/events/session-expired';
import type { AuthTokenPair } from '@src/core/ports/token-store';
import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { NOTIFICATION_QUERY_KEYS } from '@src/features/notification/queries/notification-query-keys';
import { QUERY_CACHE_MAX_AGE_MS } from '@src/shared/constants/query-persistence';
import { NetworkError } from '@src/shared/errors';
import {
  type AppLifecycleGatewayStub,
  createAnalyticsStub,
  createAppLifecycleGatewayStub,
  createErrorReporterStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createMemorySyncStorage,
  createMemoryTokenStore,
  createNetworkStatusGatewayStub,
  createPurchasesGatewayStub,
  createPushNotificationGatewayStub,
  createTestPorts,
  createTestQueryClient,
  type MemoryObservableSyncStorage,
  type NetworkStatusGatewayStub,
  type PurchasesGatewayStub,
  type PushNotificationGatewayStub,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { focusManager, onlineManager, useQueryClient } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import { StrictMode } from 'react';

import { AppProviders } from './app-providers';
import { createCompositionRoot } from './create-composition-root';
import { useAuthApi, useSessionEpoch, useTokenStore } from './di-context';

const ACCOUNT_TOKENS: AuthTokenPair = { accessToken: 'access-a', refreshToken: 'refresh-a' };
const MOUNT_COUNT = 20;

interface DeviceStubs {
  appLifecycle: AppLifecycleGatewayStub;
  networkStatus: NetworkStatusGatewayStub;
  syncStorage: MemoryObservableSyncStorage;
  widgetStorage: MemoryObservableSyncStorage;
  pushNotification: PushNotificationGatewayStub;
  purchasesGateway: PurchasesGatewayStub;
  analytics: ReturnType<typeof createAnalyticsStub>;
  errorReporter: ReturnType<typeof createErrorReporterStub>;
}

/** 운영의 `compositionRoot`와 같은 로직에 기기 포트만 stub으로 넣는다. 만든 기기 포트를 모두 남긴다 */
function createTestRoot({ tokens }: { tokens?: AuthTokenPair } = {}) {
  const createdDevices: DeviceStubs[] = [];
  const root = createCompositionRoot({
    createDevicePorts: () => {
      const httpClient = createHttpClientStub();
      httpClient.get.mockImplementation(async (path) => {
        if (path === 'v1/auth/me') {
          return ok(createCurrentUserDto());
        }
        throw new NetworkError();
      });
      httpClient.post.mockRejectedValue(new NetworkError());
      httpClient.put.mockRejectedValue(new NetworkError());
      const sessionEpoch = createSessionEpoch();
      const stubs: DeviceStubs = {
        appLifecycle: createAppLifecycleGatewayStub(),
        networkStatus: createNetworkStatusGatewayStub(),
        syncStorage: createMemoryObservableSyncStorage(),
        widgetStorage: createMemoryObservableSyncStorage(),
        pushNotification: createPushNotificationGatewayStub(),
        purchasesGateway: createPurchasesGatewayStub(),
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
      };
      createdDevices.push(stubs);
      return createTestPorts({
        ...stubs,
        httpClient,
        sessionEpoch,
        tokenStore: withSessionEpoch(createMemoryTokenStore(tokens), sessionEpoch),
      });
    },
    openEncryptedStorage: async () => ({
      draftStorage: createMemorySyncStorage(),
      queryCacheStorage: null,
    }),
    createQueryClient: createTestQueryClient,
  });
  return { root, createdDevices };
}

function getOnlyDevice(createdDevices: DeviceStubs[]): DeviceStubs {
  const [device] = createdDevices;
  if (device == null || createdDevices.length !== 1) {
    throw new Error(`기기 포트는 하나여야 합니다(${createdDevices.length}개)`);
  }
  return device;
}

function getActiveSubscriptionCount(device: DeviceStubs) {
  return {
    appLifecycle: device.appLifecycle.getListenerCount(),
    networkStatus: device.networkStatus.getListenerCount(),
    syncStorage: device.syncStorage.getListenerCount(),
    widgetStorage: device.widgetStorage.getListenerCount(),
    pushNotification: device.pushNotification.getListenerCount(),
    purchasesGateway: device.purchasesGateway.getListenerCount(),
  };
}

const NO_SUBSCRIPTIONS = {
  appLifecycle: 0,
  networkStatus: 0,
  syncStorage: 0,
  widgetStorage: 0,
  pushNotification: 0,
  purchasesGateway: 0,
};

/** 화면이 DI에서 꺼낸 값. 다시 시도 전후를 견준다 */
interface MountedApp {
  status: string;
  tokenStore: ReturnType<typeof useTokenStore>;
  sessionEpoch: ReturnType<typeof useSessionEpoch>;
  queryClient: ReturnType<typeof useQueryClient>;
  authApi: ReturnType<typeof useAuthApi>;
}

function AppProbe({ onRender }: { onRender: (app: MountedApp) => void }) {
  onRender({
    status: useAuthStatus(),
    tokenStore: useTokenStore(),
    sessionEpoch: useSessionEpoch(),
    queryClient: useQueryClient(),
    authApi: useAuthApi(),
  });
  return null;
}

/** 루트 오류 화면의 "다시 시도"처럼 앱 트리를 통째로 올린다. StrictMode라 effect가 두 번 돈다 */
async function mountApp(root: ReturnType<typeof createTestRoot>['root']) {
  const rendered: MountedApp[] = [];
  const view = await render(
    <StrictMode>
      <AppProviders root={root}>
        <AppProbe onRender={(app) => rendered.push(app)} />
      </AppProviders>
    </StrictMode>,
  );
  await act(() => jest.advanceTimersByTimeAsync(0));
  const mounted = rendered.at(-1);
  if (mounted == null) {
    throw new Error('앱 트리가 그려지지 않았습니다');
  }
  return { view, mounted };
}

/** 내린 앱이 남긴 구독이 있으면 아래 이벤트가 캐시·보고·온라인·포커스를 바꾼다 */
function emitEventsAfterUnmount(device: DeviceStubs) {
  emitNotificationsChanged();
  emitSessionExpired({ reason: 'refresh-rejected' });
  device.networkStatus.emit(false);
  device.appLifecycle.emit('background');
}

describe('AppProviders', () => {
  setupFakeTimersPerTest();

  it('로그인한 앱을 여러 번 올렸다 내려도 구독이 남지 않고 타이머가 늘지 않으며 내린 뒤 이벤트가 상태를 바꾸지 않는다', async () => {
    // Given
    const { root, createdDevices } = createTestRoot({ tokens: ACCOUNT_TOKENS });
    const ports = await root.openPorts();
    const device = getOnlyDevice(createdDevices);
    const timersBefore = jest.getTimerCount();
    const timersAfterEachUnmount: number[] = [];

    // When
    for (let mount = 0; mount < MOUNT_COUNT; mount += 1) {
      const { view, mounted } = await mountApp(root);
      expect(mounted.status).toBe('authenticated');
      await view.unmount();
      timersAfterEachUnmount.push(jest.getTimerCount());
    }
    ports.queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 3);
    emitEventsAfterUnmount(device);

    // Then
    expect(getActiveSubscriptionCount(device)).toEqual(NO_SUBSCRIPTIONS);
    expect(new Set(timersAfterEachUnmount).size).toBe(1);
    expect(
      ports.queryClient.getQueryState(NOTIFICATION_QUERY_KEYS.unreadCount())?.isInvalidated,
    ).toBe(false);
    expect(device.errorReporter.captureMessage).not.toHaveBeenCalled();
    expect(onlineManager.isOnline()).toBe(true);
    expect(focusManager.isFocused()).toBe(true);
    // 남은 것은 쿼리 gcTime이 지나면 끝나는 TanStack 정리 타이머뿐이다
    await act(() => jest.advanceTimersByTimeAsync(QUERY_CACHE_MAX_AGE_MS));
    expect(jest.getTimerCount()).toBe(timersBefore);
  });

  it('로그인하지 않은 앱을 여러 번 올렸다 내려도 구독이 남지 않고 남은 타이머는 조회 캐시 정리뿐이다', async () => {
    // Given
    const { root, createdDevices } = createTestRoot();
    await root.openPorts();
    const device = getOnlyDevice(createdDevices);
    const timersBefore = jest.getTimerCount();

    // When
    for (let mount = 0; mount < MOUNT_COUNT; mount += 1) {
      const { view, mounted } = await mountApp(root);
      expect(mounted.status).toBe('unauthenticated');
      await view.unmount();
    }
    emitEventsAfterUnmount(device);

    // Then
    expect(getActiveSubscriptionCount(device)).toEqual(NO_SUBSCRIPTIONS);
    expect(onlineManager.isOnline()).toBe(true);
    expect(focusManager.isFocused()).toBe(true);
    // 비로그인 정리가 캐시에서 지운 내 정보 조회를 보던 화면이 내려가면 TanStack이 gcTime 뒤 끝나는 타이머를 건다
    await act(() => jest.advanceTimersByTimeAsync(QUERY_CACHE_MAX_AGE_MS));
    expect(jest.getTimerCount()).toBe(timersBefore);
  });

  it('루트 "다시 시도"로 다시 올려도 로그인과 프로세스 수명 객체를 그대로 쓰고 Service만 새로 만든다', async () => {
    // Given
    const { root, createdDevices } = createTestRoot({ tokens: ACCOUNT_TOKENS });
    const first = await mountApp(root);
    await first.view.unmount();

    // When
    const second = await mountApp(root);

    // Then
    const device = getOnlyDevice(createdDevices);
    expect(first.mounted.status).toBe('authenticated');
    expect(second.mounted.status).toBe('authenticated');
    expect(second.mounted.tokenStore).toBe(first.mounted.tokenStore);
    expect(second.mounted.sessionEpoch).toBe(first.mounted.sessionEpoch);
    expect(second.mounted.queryClient).toBe(first.mounted.queryClient);
    expect(second.mounted.authApi).not.toBe(first.mounted.authApi);
    await expect(second.mounted.tokenStore.getRefreshToken()).resolves.toBe(
      ACCOUNT_TOKENS.refreshToken,
    );
    expect(device.purchasesGateway.isConfigured()).toBe(true);
  });
});
