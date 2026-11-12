import { ok } from '@src/core/errors/result';
import { emitNotificationsChanged } from '@src/core/events/notifications-changed';
import { emitSessionExpired } from '@src/core/events/session-expired';
import { emitTodoCreated } from '@src/core/events/todo-created';
import type { AuthTokenPair } from '@src/core/ports/token-store';
import { createSessionEpoch } from '@src/core/session/session-epoch';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useLogoutMutationOptions } from '@src/features/identity/auth/queries/auth.mutations';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { NOTIFICATION_QUERY_KEYS } from '@src/features/notification/queries/notification-query-keys';
import { QUERY_CACHE_MAX_AGE_MS } from '@src/shared/constants/query-persistence';
import { NetworkError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import type { EncryptedStorageBootstrap } from '@src/shared/infra/storage/encrypted-draft-storage';
import { readStoredValue } from '@src/shared/storage/define-stored-value';
import {
  type AppLifecycleGatewayStub,
  createAnalyticsStub,
  createAppLifecycleGatewayStub,
  createErrorReporterStub,
  createHttpClientStub,
  createIncomingLinkGatewayStub,
  createMemoryObservableSyncStorage,
  createMemorySyncStorage,
  createMemoryTokenStore,
  createNetworkStatusGatewayStub,
  createPurchasesGatewayStub,
  createPushNotificationGatewayStub,
  createSpeechRecognizerStub,
  createTestPorts,
  createTestQueryClient,
  type IncomingLinkGatewayStub,
  type MemoryObservableSyncStorage,
  type NetworkStatusGatewayStub,
  type PurchasesGatewayStub,
  type PushNotificationGatewayStub,
  setupFakeTimersPerTest,
  type SpeechRecognizerStub,
} from '@src/testing/core';
import { renderRoutes } from '@src/testing/render-route-hook';
import { focusManager, onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { StrictMode } from 'react';

import * as AppLayoutRoute from '../../../app/(app)/_layout';
import RootIndex from '../../../app/index';
import { AuthGateLayout } from '../navigation/auth-gate-layout';
import { pendingStorageCleanupStoredValue } from '../schemas/pending-storage-cleanup-storage.schema';
import { AppProviders } from './app-providers';
import { createCompositionRoot } from './create-composition-root';
import { useAuthApi, useSessionEpoch, useTokenStore } from './di-context';

// 루트 레이아웃(AuthGateLayout)과 앱 화면 묶음 레이아웃의 훅까지 실제 라우터로 올린다
jest.unmock('expo-router');

const ACCOUNT_A_TOKENS: AuthTokenPair = { accessToken: 'access-a', refreshToken: 'refresh-a' };
const ACCOUNT_B_TOKENS: AuthTokenPair = { accessToken: 'access-b', refreshToken: 'refresh-b' };
const ACCOUNT_A = createCurrentUserDto({ userId: 'clz7x5p8k0001qz0z8z8z8zaa' });
const ACCOUNT_B = createCurrentUserDto({ userId: 'clz7x5p8k0001qz0z8z8z8zbb' });
const MOUNT_COUNT = 20;
const QUERY_CACHE_OWNER_KEY = 'aido.query-cache.owner';

interface DeviceStubs {
  appLifecycle: AppLifecycleGatewayStub;
  networkStatus: NetworkStatusGatewayStub;
  syncStorage: MemoryObservableSyncStorage;
  widgetStorage: MemoryObservableSyncStorage;
  pushNotification: PushNotificationGatewayStub;
  purchases: PurchasesGatewayStub;
  incomingLink: IncomingLinkGatewayStub;
  speechRecognizer: SpeechRecognizerStub;
  analytics: ReturnType<typeof createAnalyticsStub>;
  errorReporter: ReturnType<typeof createErrorReporterStub>;
}

type EncryptedStorageCase = 'opened' | 'unavailable';

interface TestRootOptions {
  tokens?: AuthTokenPair;
  /** 암호화 저장소를 연 실행(조회 캐시를 기기에 저장)인지, 열지 못한 실행인지 */
  encryptedStorage?: EncryptedStorageCase;
}

/** 운영의 `compositionRoot`와 같은 로직에 기기 포트만 stub으로 넣는다. 만든 기기 포트를 모두 남긴다 */
function createTestRoot({ tokens, encryptedStorage = 'opened' }: TestRootOptions = {}) {
  const createdDevices: DeviceStubs[] = [];
  const account = { current: ACCOUNT_A };
  // 조회 캐시 인스턴스는 실행 사이에 남는 파일이라 열 때마다 같은 것을 준다
  const queryCacheFile = createMemorySyncStorage();
  const root = createCompositionRoot({
    createDevicePorts: () => {
      const httpClient = createHttpClientStub();
      httpClient.get.mockImplementation(async (path) => {
        if (path === 'v1/auth/me') {
          return ok(account.current);
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
        purchases: createPurchasesGatewayStub(),
        incomingLink: createIncomingLinkGatewayStub(),
        speechRecognizer: createSpeechRecognizerStub(),
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
      };
      createdDevices.push(stubs);
      return createTestPorts({
        ...stubs,
        httpClient,
        sessionEpoch,
        tokenStore: createMemoryTokenStore(tokens),
      });
    },
    openEncryptedStorage: async (): Promise<EncryptedStorageBootstrap> =>
      encryptedStorage === 'opened'
        ? { draftStorage: createMemorySyncStorage(), queryCacheStorage: queryCacheFile }
        : {
            draftStorage: createMemorySyncStorage(),
            queryCacheStorage: null,
            failure: new Error('keychain locked'),
          },
    createQueryClient: createTestQueryClient,
  });
  return { root, createdDevices, account, queryCacheFile };
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
    purchases: device.purchases.getListenerCount(),
    incomingLink: device.incomingLink.getListenerCount(),
    speechRecognizer: device.speechRecognizer.getListenerCount(),
  };
}

const NO_SUBSCRIPTIONS = {
  appLifecycle: 0,
  networkStatus: 0,
  syncStorage: 0,
  widgetStorage: 0,
  pushNotification: 0,
  purchases: 0,
  incomingLink: 0,
  speechRecognizer: 0,
};

/** 화면이 DI에서 꺼낸 값. 다시 시도 전후를 견준다 */
interface MountedApp {
  status: string;
  tokenStore: ReturnType<typeof useTokenStore>;
  sessionEpoch: ReturnType<typeof useSessionEpoch>;
  queryClient: ReturnType<typeof useQueryClient>;
  authApi: ReturnType<typeof useAuthApi>;
  logout: () => void;
}

/** 실제 라우터가 그린 화면에서 앱 값을 읽는다. 루트 레이아웃이 다시 그려져도 마지막 값을 남긴다 */
function createProbe() {
  const rendered: MountedApp[] = [];

  function ProbeScreen() {
    const logout = useMutation(useLogoutMutationOptions());
    rendered.push({
      status: useAuthStatus(),
      tokenStore: useTokenStore(),
      sessionEpoch: useSessionEpoch(),
      queryClient: useQueryClient(),
      authApi: useAuthApi(),
      logout: () => logout.mutate(),
    });
    return null;
  }

  function latest(): MountedApp {
    const mounted = rendered.at(-1);
    if (mounted == null) {
      throw new Error('앱 화면이 그려지지 않았습니다');
    }
    return mounted;
  }

  return { ProbeScreen, latest };
}

function EmptyScreen() {
  return null;
}

function GroupStack() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}

/** 루트 오류 화면의 "다시 시도"처럼 앱 트리를 통째로 올린다. StrictMode라 effect가 두 번 돈다 */
async function mountApp(root: ReturnType<typeof createTestRoot>['root']) {
  const probe = createProbe();
  function RootLayout() {
    return (
      <StrictMode>
        <AppProviders root={root}>
          <AuthGateLayout />
        </AppProviders>
      </StrictMode>
    );
  }

  const view = await renderRoutes(
    {
      _layout: RootLayout,
      index: RootIndex,
      loading: EmptyScreen,
      'invite/index': EmptyScreen,
      '(auth)/_layout': GroupStack,
      '(auth)/login': probe.ProbeScreen,
      '(app)/_layout': AppLayoutRoute,
      '(app)/(tabs)/_layout': GroupStack,
      '(app)/(tabs)/feed/index': probe.ProbeScreen,
    },
    { url: '/' },
  );
  await act(() => jest.advanceTimersByTimeAsync(0));
  return { view, mounted: probe.latest, getPathname: () => view.getPathname() };
}

/** 기기 저장소 값 전체. 내린 앱의 구독이 남아 저장을 다시 했는지 본다 */
function snapshotStorage(storage: MemoryObservableSyncStorage) {
  return Object.fromEntries(storage.keys().map((key) => [key, storage.get(key)]));
}

/** 내린 앱이 남긴 구독이 있으면 아래 이벤트가 캐시·보고·저장·온라인·포커스를 바꾼다 */
function emitEventsAfterUnmount(device: DeviceStubs) {
  emitNotificationsChanged();
  emitSessionExpired({ reason: 'refresh-rejected' });
  emitTodoCreated();
  // 언어 구독이 남으면 조회를 모두 무효화한다
  i18n.emit('languageChanged', 'en');
  device.networkStatus.emit(false);
  device.appLifecycle.emit('background');
  device.incomingLink.emit('aido://feed');
}

describe('AppProviders', () => {
  setupFakeTimersPerTest();

  beforeEach(() => {
    // 앱 화면 묶음 레이아웃이 선언한 화면을 다 만들지 않아 expo-router가 화면마다 남기는 경고만 거른다
    const warn = console.warn;
    jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      if (String(args[0]).startsWith('[Layout children]')) {
        return;
      }
      warn(...args);
    });
  });

  it('로그인한 앱을 여러 번 올렸다 내려도 구독이 남지 않고 타이머가 늘지 않으며 내린 뒤 이벤트가 상태를 바꾸지 않는다', async () => {
    // Given
    const { root, createdDevices } = createTestRoot({ tokens: ACCOUNT_A_TOKENS });
    const ports = await root.openPorts();
    const device = getOnlyDevice(createdDevices);
    const timersBefore = jest.getTimerCount();
    const timersAfterEachUnmount: number[] = [];

    // When
    for (let mount = 0; mount < MOUNT_COUNT; mount += 1) {
      const { view, mounted, getPathname } = await mountApp(root);
      expect(getPathname()).toBe('/feed');
      expect(mounted().status).toBe('authenticated');
      await view.unmount();
      timersAfterEachUnmount.push(jest.getTimerCount());
    }
    ports.queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 3);
    const storageBefore = snapshotStorage(device.syncStorage);
    emitEventsAfterUnmount(device);

    // Then
    expect(getActiveSubscriptionCount(device)).toEqual(NO_SUBSCRIPTIONS);
    // 조회 캐시 저장을 미루는 타이머(persister throttle) 하나가 내릴 때 남았는지에 따라 하나 차이 날 뿐 마운트마다 늘지 않는다
    expect(
      Math.max(...timersAfterEachUnmount) - Math.min(...timersAfterEachUnmount),
    ).toBeLessThanOrEqual(1);
    expect(
      ports.queryClient.getQueryState(NOTIFICATION_QUERY_KEYS.unreadCount())?.isInvalidated,
    ).toBe(false);
    expect(snapshotStorage(device.syncStorage)).toEqual(storageBefore);
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
      const { view, mounted, getPathname } = await mountApp(root);
      expect(getPathname()).toBe('/login');
      expect(mounted().status).toBe('unauthenticated');
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
    const { root, createdDevices } = createTestRoot({ tokens: ACCOUNT_A_TOKENS });
    const first = await mountApp(root);
    const firstApp = first.mounted();
    await first.view.unmount();

    // When
    const second = await mountApp(root);

    // Then
    const secondApp = second.mounted();
    const device = getOnlyDevice(createdDevices);
    expect(firstApp.status).toBe('authenticated');
    expect(secondApp.status).toBe('authenticated');
    expect(secondApp.tokenStore).toBe(firstApp.tokenStore);
    expect(secondApp.sessionEpoch).toBe(firstApp.sessionEpoch);
    expect(secondApp.queryClient).toBe(firstApp.queryClient);
    expect(secondApp.authApi).not.toBe(firstApp.authApi);
    await expect(secondApp.tokenStore.getRefreshToken()).resolves.toBe(
      ACCOUNT_A_TOKENS.refreshToken,
    );
    expect(device.purchases.isConfigured()).toBe(true);
    await second.view.unmount();
  });

  it('조회 캐시를 기기에 저장하는 실행에서 A가 로그아웃하고 B로 다시 올려도 A의 캐시가 남지 않고 구독도 남지 않는다', async () => {
    // Given
    const { root, createdDevices, account, queryCacheFile } = createTestRoot({
      tokens: ACCOUNT_A_TOKENS,
    });
    const first = await mountApp(root);
    await act(() => jest.advanceTimersByTimeAsync(1_000));
    expect(queryCacheFile.get(QUERY_CACHE_OWNER_KEY)).toBe(ACCOUNT_A.userId);

    // When
    await act(async () => first.mounted().logout());
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(first.getPathname()).toBe('/login');
    await first.view.unmount();
    account.current = ACCOUNT_B;
    const ports = await root.openPorts();
    await ports.tokenStore.save(ACCOUNT_B_TOKENS);
    const second = await mountApp(root);

    // Then
    expect(second.mounted().status).toBe('authenticated');
    expect(queryCacheFile.get(QUERY_CACHE_OWNER_KEY)).toBe(ACCOUNT_B.userId);
    expect(queryCacheFile.keys().filter((key) => key.includes(ACCOUNT_A.userId))).toEqual([]);
    await second.view.unmount();
    expect(getActiveSubscriptionCount(getOnlyDevice(createdDevices))).toEqual(NO_SUBSCRIPTIONS);
  });

  it('암호화 저장소를 열지 못한 실행에서 로그아웃하면 다음 실행 정리를 표시하고 구독을 남기지 않는다', async () => {
    // Given
    const { root, createdDevices } = createTestRoot({
      tokens: ACCOUNT_A_TOKENS,
      encryptedStorage: 'unavailable',
    });
    const { view, mounted, getPathname } = await mountApp(root);
    const device = getOnlyDevice(createdDevices);

    // When
    await act(async () => mounted().logout());
    await act(() => jest.advanceTimersByTimeAsync(0));

    // Then
    expect(getPathname()).toBe('/login');
    expect(readStoredValue(device.syncStorage, pendingStorageCleanupStoredValue)).toEqual({
      queryCache: true,
      drafts: true,
    });
    await view.unmount();
    expect(getActiveSubscriptionCount(device)).toEqual(NO_SUBSCRIPTIONS);
  });
});
