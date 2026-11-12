import { MyPageStack } from '@src/bootstrap/navigation/my-page-stack';
import { ok } from '@src/core/errors/result';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { readStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createPendingResponse,
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
  stubWindowDimensions,
} from '@src/testing/core';
import { Stack as TestStack } from '@src/testing/mocks/expo-router';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Suspense, useEffect } from 'react';
import { Text } from 'react-native';

import { unstable_settings as myPageTabSettings } from '../../../../app/(app)/(tabs)/(mypage)/_layout';
import * as TabsLayoutRoute from '../../../../app/(app)/(tabs)/_layout';
import * as AppLayoutRoute from '../../../../app/(app)/_layout';
import NotificationOnboardingScreen from '../../../../app/(app)/onboarding/notifications';
import { createPushPermissionResponse } from '../__tests__/notification.fixtures';
import { PUSH_PERMISSION_QUERY_KEYS } from '../queries/push-permission-query-keys';
import { pushPermissionDeferredAtStoredValue } from '../schemas/push-permission-deferred-at-storage.schema';
import { useOpenPushOnboarding } from './use-open-push-onboarding';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

// 네이티브 헤더는 Jest에서 그려지지 않는다. 라우터는 그대로 두고 헤더 버튼만 jest.setup의 누를 수 있는 버튼으로 바꾼다
Object.assign(Stack, { Toolbar: TestStack.Toolbar });

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

const UNDETERMINED = createPushPermissionResponse({ status: 'undetermined', canAskAgain: true });

const WINDOW_WIDTHS = [
  ['좁은 화면', 390],
  ['넓은 화면', 900],
] as const;

const feedMounted = jest.fn();

function EmptyScreen() {
  return null;
}

function FeedScreen() {
  useOpenPushOnboarding({ isStable: true });
  useEffect(() => feedMounted(), []);
  return <Text testID="feed">Feed</Text>;
}

function MemoScreen() {
  return <Text testID="memo">Memo</Text>;
}

function MyPageScreen() {
  return <Text testID="mypage">MyPage</Text>;
}

function TabStackLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}

async function renderAppRoutes({
  permission,
  requestedPermission,
  requestError,
  initialUrl = '/feed',
  feedScreen = FeedScreen,
}: {
  permission: PushPermissionResponse | Promise<PushPermissionResponse>;
  requestedPermission?: PushPermissionResponse;
  /** 권한 창을 띄우지 못할 때 */
  requestError?: Error;
  initialUrl?: string;
  feedScreen?: typeof FeedScreen;
}) {
  const queryClient = createTestQueryClient();
  const httpClient = createHttpClientStub();
  // 다시 조회해도 가입 시각이 같아야 한다. 조회마다 새로 만들면 가입이 화면의 지금보다 뒤가 되어 답하지 않아도 화면이 닫힌다
  const me = createCurrentUserDto({ createdAt: new Date().toISOString() });
  httpClient.get.mockImplementation(async () => ok(me));
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getPermission.mockImplementation(() => Promise.resolve(permission));
  pushNotification.requestPermission.mockImplementation(() =>
    requestError == null
      ? Promise.resolve(requestedPermission ?? permission)
      : Promise.reject(requestError),
  );
  const syncStorage = createMemoryObservableSyncStorage();
  const di = createTestDi({
    ports: { queryClient, httpClient, pushNotification, syncStorage },
    seeds: { authSessionStore: createAuthSessionStoreStub('authenticated') },
  });

  const route = await renderAppRoute(
    {
      _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
      '(app)/_layout': AppLayoutRoute,
      '(app)/(tabs)/_layout': TabsLayoutRoute,
      '(app)/(tabs)/feed/_layout': TabStackLayout,
      '(app)/(tabs)/feed/index': feedScreen,
      '(app)/(tabs)/memo/_layout': TabStackLayout,
      '(app)/(tabs)/memo/index': MemoScreen,
      // 메뉴 칸은 이 테스트의 관심이 아니라 글자로 대신한다. 넓은 화면의 칸 나누기는 그대로 탄다
      '(app)/(tabs)/(mypage)/_layout': {
        default: () => <MyPageStack menu={<Text>menu</Text>} />,
        unstable_settings: myPageTabSettings,
      },
      '(app)/(tabs)/(mypage)/mypage/index': MyPageScreen,
      '(app)/onboarding/notifications': NotificationOnboardingScreen,
      ...Object.fromEntries(APP_STACK_SCREENS.map((name) => [`(app)/${name}`, EmptyScreen])),
    },
    { url: initialUrl, di, withLocalDate: true, withOverlay: true },
  );
  return { route, queryClient, syncStorage, accountId: me.userId };
}

/** 다시 연 앱은 저장한 할 일을 받은 뒤에야 피드 본문이 그려진다. 권한 조회가 끝난 바로 다음에 본문이 처음 그려지게 한다 */
function createFeedAfterPermissionScreen(permissionResponse: Promise<unknown>) {
  async function getTodosAfterPermission() {
    await permissionResponse;
    for (const _hop of Array.from({ length: 5 })) {
      await Promise.resolve();
    }
    return 'todos';
  }

  function FeedBody() {
    useSuspenseQuery({ queryKey: ['feed-body'], queryFn: getTodosAfterPermission });
    useOpenPushOnboarding({ isStable: true });
    return <Text testID="feed">Feed</Text>;
  }

  return function FeedAfterPermissionScreen() {
    return (
      <Suspense fallback={null}>
        <FeedBody />
      </Suspense>
    );
  };
}

async function pressContinue() {
  await fireEvent.press(screen.getByText('계속'));
}

async function pressClose() {
  await fireEvent.press(screen.getByLabelText('닫기'));
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

  describe.each(WINDOW_WIDTHS)('%s', (_label, width) => {
    beforeEach(() => {
      stubWindowDimensions(width);
    });

    it.each([
      ['[계속] 뒤 OS에서 허용', pressContinue, 'granted'],
      ['[계속] 뒤 OS에서 거부', pressContinue, 'denied'],
      ['헤더 닫기', pressClose, 'undetermined'],
    ] as const)(
      '새 가입자가 피드 위에 열린 알림 화면에서 %s하면, 마이 탭이 아니라 원래 있던 피드로 돌아온다',
      async (_case, answer, requestedStatus) => {
        // Given
        const consoleError = jest.spyOn(console, 'error');
        const { route } = await renderAppRoutes({
          permission: UNDETERMINED,
          requestedPermission: createPushPermissionResponse({
            status: requestedStatus,
            canAskAgain: requestedStatus === 'undetermined',
          }),
        });
        await waitFor(() => expect(route.getPathname()).toBe('/onboarding/notifications'));

        // When
        await answer();

        // Then
        await waitFor(() => expect(screen.queryByText('계속')).toBeNull());
        expect(route.getPathname()).toBe('/feed');
        expect(screen.getByTestId('feed')).toBeTruthy();
        expect(feedMounted).toHaveBeenCalledTimes(1);
        expect(router.canGoBack()).toBe(false);
        expect(getUnhandledNavigationErrors(consoleError)).toEqual([]);
      },
    );
  });

  it('[계속] 뒤 권한 창을 띄우지 못하면 닫은 것으로 남겨 원래 있던 피드로 돌아온다', async () => {
    // Given
    const { route, syncStorage, accountId } = await renderAppRoutes({
      permission: UNDETERMINED,
      requestError: new Error('unavailable'),
    });
    await waitFor(() => expect(route.getPathname()).toBe('/onboarding/notifications'));

    // When
    await pressContinue();

    // Then
    await waitFor(() => expect(screen.queryByText('계속')).toBeNull());
    expect(route.getPathname()).toBe('/feed');
    expect(
      readStoredValue(syncStorage, pushPermissionDeferredAtStoredValue, accountId),
    ).not.toBeNull();
  });

  it('다른 탭에서 링크로 열린 알림 화면은 답한 뒤 그 탭으로 돌아온다', async () => {
    // Given
    const { route } = await renderAppRoutes({ permission: UNDETERMINED, initialUrl: '/memo' });
    await act(() => router.push('/onboarding/notifications'));
    await waitFor(() => expect(route.getPathname()).toBe('/onboarding/notifications'));

    // When
    await pressClose();

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/memo'));
    expect(screen.getByTestId('memo')).toBeTruthy();

    // When
    await act(() => router.back());

    // Then
    expect(route.getPathname()).toBe('/feed');
    expect(router.canGoBack()).toBe(false);
  });

  it.each(['granted', 'denied'] as const)(
    '기기 권한이 %s인 사용자는 알림 화면이 열리지 않고, 링크로도 열리지 않으며 경고를 남기지 않는다',
    async (status) => {
      // Given
      const consoleError = jest.spyOn(console, 'error');
      const { route, queryClient } = await renderAppRoutes({
        permission: createPushPermissionResponse({ status }),
      });
      await waitFor(() => {
        expect(queryClient.getQueryData(USER_QUERY_KEYS.me())).toBeDefined();
        expect(queryClient.getQueryData(PUSH_PERMISSION_QUERY_KEYS.current())).toBeDefined();
      });

      // When
      await act(() => router.push('/onboarding/notifications'));

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/feed'));
      expect(screen.getByTestId('feed')).toBeTruthy();
      expect(screen.queryByText('계속')).toBeNull();
      expect(router.canGoBack()).toBe(false);
      expect(getUnhandledNavigationErrors(consoleError)).toEqual([]);
    },
  );

  it('이미 답한 사용자가 앱을 새로 열며 알림 화면 링크로 들어와도 피드가 열린다', async () => {
    // Given
    const { route } = await renderAppRoutes({
      permission: createPushPermissionResponse({ status: 'granted' }),
      initialUrl: '/onboarding/notifications',
    });

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(screen.getByTestId('feed')).toBeTruthy();
    expect(screen.queryByText('계속')).toBeNull();
  });

  it('다시 연 앱에서 권한을 읽자마자 피드 본문이 그려져도 알림 화면이 열린 채 남는다', async () => {
    // Given
    const permissionResponse = createPendingResponse(UNDETERMINED);
    const { route } = await renderAppRoutes({
      permission: permissionResponse.response,
      feedScreen: createFeedAfterPermissionScreen(permissionResponse.response),
    });

    // When
    await act(async () => permissionResponse.settle());

    // Then
    await waitFor(() => expect(screen.getByText('계속')).toBeTruthy());
    expect(route.getPathname()).toBe('/onboarding/notifications');
  });
});
