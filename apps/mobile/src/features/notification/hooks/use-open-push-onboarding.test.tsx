import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { ok } from '@src/core/errors/result';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import {
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
  TestUiProvider,
} from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { PropsWithChildren } from 'react';
import { Text } from 'react-native';

import * as AppLayoutRoute from '../../../../app/(app)/_layout';
import NotificationOnboardingScreen from '../../../../app/(app)/onboarding/notifications';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import { useOpenPushOnboarding } from './use-open-push-onboarding';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

// 앱 화면 묶음 레이아웃이 선언하는 화면이다. 없으면 레이아웃이 화면마다 경고를 남긴다
const APP_STACK_SCREENS = [
  'notifications/index',
  'nudges/[nudgeId]',
  'suggestions/index',
  'weather',
  'whats-new/index',
  'paywall',
  'memo',
  'voice-notes',
  'todo/new',
  'todo/[todoId]/actions',
  'todo/[todoId]/edit',
  'todo/[todoId]/date',
  'todo/[todoId]/time',
  'todo/[todoId]/category',
  'todo/[todoId]/thanks',
  'todo/[todoId]/report',
  'todo/[todoId]/comments/[commentId]/report',
  'todo/[todoId]/sub-todos/new',
  'todo/[todoId]/sub-todos/[subTodoId]/actions',
  'todo/[todoId]/sub-todos/[subTodoId]/edit',
  'todo-categories/new',
  'todo-categories/[categoryId]/edit',
  'invite-welcome/[friendId]',
  'users/[userId]/block',
  'users/[userId]/report',
  'users/[userId]/nudge',
  'suggestions/[suggestionId]/category',
] as const;

function EmptyScreen() {
  return null;
}

function FeedScreen() {
  useOpenPushOnboarding({ isStable: true });
  return <Text testID="feed">Feed</Text>;
}

async function renderAppRoutes(permission: PushPermissionResponse) {
  const queryClient = createTestQueryClient();
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async () =>
    ok(createCurrentUserDto({ createdAt: new Date().toISOString() })),
  );
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getPermission.mockResolvedValue(permission);
  const container = createTestDi({
    queryClient,
    httpClient,
    pushNotification,
    authSessionStore: createAuthSessionStoreStub('authenticated'),
    syncStorage: createMemoryObservableSyncStorage(),
  });
  function AppFixture({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <StaticDIProvider container={container}>
          <TestUiProvider>
            <LocalDateProvider>
              <OverlayProvider>{children}</OverlayProvider>
            </LocalDateProvider>
          </TestUiProvider>
        </StaticDIProvider>
      </QueryClientProvider>
    );
  }

  const route = await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
      '(app)/_layout': AppLayoutRoute,
      '(app)/(tabs)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
      '(app)/(tabs)/feed/index': FeedScreen,
      '(app)/onboarding/notifications': NotificationOnboardingScreen,
      ...Object.fromEntries(APP_STACK_SCREENS.map((name) => [`(app)/${name}`, EmptyScreen])),
    },
    { initialUrl: '/feed', wrapper: AppFixture },
  );
  return { route, queryClient };
}

function getUnhandledNavigationErrors(consoleError: jest.SpyInstance) {
  return consoleError.mock.calls
    .map(([message]) => String(message))
    .filter((message) => message.includes('was not handled by any navigator'));
}

describe('가입 직후 알림 화면 — 실제 라우터', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: (callback: IdleRequestCallback) => {
        callback({ didTimeout: false, timeRemaining: () => 10 });
        return 1;
      },
    });
    Object.defineProperty(globalThis, 'cancelIdleCallback', {
      configurable: true,
      value: () => undefined,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('아직 묻지 않은 새 가입자는 피드 위에 알림 화면이 열리고, [나중에]를 누르면 피드로 돌아온다', async () => {
    // Given
    const consoleError = jest.spyOn(console, 'error');
    const { route } = await renderAppRoutes({
      status: 'undetermined',
      canAskAgain: true,
      iosStatus: null,
    });
    await waitFor(() => expect(route.getPathname()).toBe('/onboarding/notifications'));

    // When
    await fireEvent.press(screen.getByText('나중에'));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(screen.queryByText('나중에')).toBeNull();
    expect(getUnhandledNavigationErrors(consoleError)).toEqual([]);
  });

  it.each(['granted', 'denied'] as const)(
    '기기 권한이 %s인 사용자는 알림 화면이 열리지 않고, 링크로도 열리지 않으며 경고를 남기지 않는다',
    async (status) => {
      // Given
      const consoleError = jest.spyOn(console, 'error');
      const { route, queryClient } = await renderAppRoutes({
        status,
        canAskAgain: false,
        iosStatus: null,
      });
      await waitFor(() => {
        expect(queryClient.getQueryData(USER_QUERY_KEYS.me())).toBeDefined();
        expect(queryClient.getQueryData(NOTIFICATION_QUERY_KEYS.permission())).toBeDefined();
      });

      // When
      await act(() => router.push('/onboarding/notifications'));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/feed'));
      expect(screen.getByTestId('feed')).toBeTruthy();
      expect(screen.queryByText('나중에')).toBeNull();
      expect(getUnhandledNavigationErrors(consoleError)).toEqual([]);
    },
  );
});
