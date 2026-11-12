import { err, ok, type Result } from '@src/core/errors/result';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createMarkReadResponseDto } from '@src/features/notification/__tests__/notification.fixtures';
import { NOTIFICATION_READ_BUDGET_MS } from '@src/features/notification/constants/notification.constants';
import { ApiError, NetworkError } from '@src/shared/errors';
import {
  createAppLifecycleGatewayStub,
  createExternalLinkGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createPushNotificationGatewayStub,
  createTestDi,
  stubWindowDimensions,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { userEvent } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import * as ExpoLinking from 'expo-linking';
import { router, Stack, useFocusEffect } from 'expo-router';
import { act, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback } from 'react';
import { Linking, Pressable, Text } from 'react-native';

import RootIndex from '../../../app/index';
import { AuthGateLayout } from './auth-gate-layout';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

const TODO_RESPONSE: PushNotificationResponse = {
  id: 'response-1',
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  data: {
    notificationId: 7,
    type: 'TODO_SHARED',
    action: { type: 'DEEP_LINK' },
    context: { todoId: 42 },
    navigation: { kind: 'TODO', todoId: 42 },
  },
};

const SECOND_TODO_RESPONSE: PushNotificationResponse = {
  id: 'response-2',
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  data: {
    notificationId: 8,
    type: 'TODO_SHARED',
    action: { type: 'DEEP_LINK' },
    context: { todoId: 43 },
    navigation: { kind: 'TODO', todoId: 43 },
  },
};

const READ_OK = ok(createMarkReadResponseDto());

interface SetupOptions {
  status: AuthStatus;
  initialUrl?: string;
  lastResponse?: PushNotificationResponse;
  markRead?: () => Promise<Result<unknown, ApiError>>;
}

async function setup({ status, initialUrl = '/', lastResponse, markRead }: SetupOptions) {
  const gateway = createPushNotificationGatewayStub();
  gateway.setLastResponse(lastResponse ?? null);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (url: string) =>
    url === 'v1/auth/me' ? ok(createCurrentUserDto()) : ok({ unreadCount: 0 }),
  );
  httpClient.patch.mockImplementation(markRead ?? (async () => READ_OK));
  httpClient.post.mockImplementation(async () => ok({ opened: true }));
  const authSessionStore = createAuthSessionStoreStub(status);
  const focusLog: string[] = [];
  const hideLog: string[] = [];

  function LoadingScreen() {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="boot-authenticated"
        onPress={() => authSessionStore.setStatus('authenticated')}
      >
        <Text>Restore session</Text>
      </Pressable>
    );
  }

  function LoginScreen() {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="login"
        onPress={() => authSessionStore.setStatus('authenticated')}
      >
        <Text>Login</Text>
      </Pressable>
    );
  }

  function FeedScreen() {
    useFocusEffect(
      useCallback(() => {
        focusLog.push('feed');
      }, []),
    );
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="logout"
        onPress={() => authSessionStore.setStatus('unauthenticated')}
      >
        <Text>Feed</Text>
      </Pressable>
    );
  }

  function TodoScreen() {
    useFocusEffect(
      useCallback(() => {
        focusLog.push('todo');
      }, []),
    );
    return <Text testID="todo-detail">Todo details</Text>;
  }

  const externalLink = createExternalLinkGatewayStub();
  const appLifecycle = createAppLifecycleGatewayStub();
  const di = createTestDi({
    ports: { externalLink, appLifecycle, httpClient, pushNotification: gateway },
    seeds: { authSessionStore },
  });

  const route = await renderAppRoute(
    {
      _layout: AuthGateLayout,
      index: RootIndex,
      loading: LoadingScreen,
      'invite/index': () => <Text>Invite</Text>,
      '(auth)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
      '(auth)/login': LoginScreen,
      '(app)/_layout': {
        default: () => <Stack screenOptions={{ animation: 'none' }} />,
        unstable_settings: { anchor: '(tabs)' },
      },
      '(app)/(tabs)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
      '(app)/(tabs)/feed/index': FeedScreen,
      '(app)/notifications/index': () => <Text testID="notifications">Notifications</Text>,
      '(app)/todo/[todoId]/index': TodoScreen,
    },
    { url: initialUrl, di, withLocalDate: true },
  );

  jest.mocked(SplashScreen.hideAsync).mockImplementation(async () => {
    hideLog.push(route.getPathname());
  });

  return {
    route,
    gateway,
    httpClient,
    focusLog,
    hideLog,
    externalLink,
    appLifecycle,
    analytics: di.analytics,
  };
}

describe('푸시 탭 진입', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubWindowDimensions(390);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('앱 종료 상태 탭: 스플래시 뒤에서 목적지로 바로 가 피드가 focus되지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    const read = createPendingResponse(READ_OK);
    const { route, gateway, focusLog, hideLog, analytics } = await setup({
      status: 'loading',
      lastResponse: TODO_RESPONSE,
      markRead: () => read.response,
    });
    expect(route.getPathname()).toBe('/loading');

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(gateway.clearLastResponse).not.toHaveBeenCalled());
    expect(route.getPathname()).toBe('/loading');
    expect(hideLog).toEqual([]);

    // When
    await act(async () => read.settle());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    await waitFor(() => expect(hideLog).toEqual(['/todo/42']));
    expect(focusLog).toEqual(['todo']);
    await waitFor(() => expect(gateway.clearLastResponse).toHaveBeenCalled());
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'push_notification_opened',
      expect.objectContaining({ app_state: 'cold' }),
    );
  });

  it('뒤에 있던 앱의 탭: 한 번만 이동하고 열림을 background로 한 번 남긴다', async () => {
    // Given
    const { route, gateway, appLifecycle, analytics } = await setup({ status: 'authenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    await act(async () => appLifecycle.emit('background'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));
    await act(async () => appLifecycle.emit('active'));
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'push_notification_opened',
        expect.objectContaining({ app_state: 'background' }),
      ),
    );
    expect(
      jest
        .mocked(analytics.trackEvent)
        .mock.calls.filter(([eventName]) => eventName === 'push_notification_opened'),
    ).toHaveLength(1);
  });

  it('앱 종료 상태 탭: 다른 계정 알림은 버리고 피드로 간다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, gateway, focusLog } = await setup({
      status: 'loading',
      lastResponse: TODO_RESPONSE,
      markRead: async () => err(new ApiError('NOTIFICATION_1001', '없어요', 404)),
    });

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(focusLog).toEqual(['feed']);
    expect(gateway.getLastResponse()).toBeNull();
  });

  it('앱 종료 상태 탭: 오프라인이어도 목적지로 간다', async () => {
    // Given
    const user = userEvent.setup();
    const { route } = await setup({
      status: 'loading',
      lastResponse: TODO_RESPONSE,
      markRead: async () => {
        throw new NetworkError();
      },
    });

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('앱 종료 상태 탭: 이동 없는 알림은 피드로 간다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, focusLog, gateway } = await setup({
      status: 'loading',
      lastResponse: {
        ...TODO_RESPONSE,
        data: {
          notificationId: 0,
          type: 'SYSTEM_NOTICE',
          action: { type: 'NONE' },
          navigation: { kind: 'NONE' },
        },
      },
    });

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(focusLog).toEqual(['feed']);
    await waitFor(() => expect(gateway.getLastResponse()).toBeNull());
  });

  it('앱 종료 상태 탭: 외부 링크는 피드로 간 뒤 한 번만 연다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, externalLink } = await setup({
      status: 'loading',
      lastResponse: {
        ...TODO_RESPONSE,
        data: {
          notificationId: 0,
          type: 'SYSTEM_NOTICE',
          action: { type: 'BROWSER', url: 'https://aido.kr/notice' },
          navigation: {
            kind: 'EXTERNAL_URL',
            url: 'https://aido.kr/notice',
            presentation: 'BROWSER',
          },
        },
      },
    });

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    await waitFor(() => expect(externalLink.open).toHaveBeenCalledTimes(1));
    expect(externalLink.open).toHaveBeenCalledWith('https://aido.kr/notice');
  });

  it('앱 종료 상태 탭: 펼친 화면은 피드의 상세 pane으로 연다', async () => {
    // Given
    const user = userEvent.setup();
    stubWindowDimensions(1000);
    const { route, hideLog } = await setup({ status: 'loading', lastResponse: TODO_RESPONSE });

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(hideLog).toEqual(['/feed']));
    expect(route.getSearchParams()).toMatchObject({ todoId: '42' });
  });

  it('공개 화면에서 탭: 인증된 사용자는 Index를 거치지 않고 바로 이동한다', async () => {
    // Given
    const { route, gateway } = await setup({ status: 'authenticated', initialUrl: '/invite' });
    await waitFor(() => expect(route.getPathname()).toBe('/invite'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('앱 종료 상태 탭: 뒤로 가면 피드이고 다시 이동하지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, gateway } = await setup({ status: 'loading', lastResponse: TODO_RESPONSE });
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));

    // When
    await act(() => router.back());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(gateway.getLastResponse()).toBeNull();

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    expect(route.getPathname()).toBe('/feed');
  });

  it('잠금 중 콜드 스타트: 스피너로 넘겼다가 잠금이 풀리면 이동한다', async () => {
    // Given
    const user = userEvent.setup();
    const { route } = await setup({ status: 'locked', lastResponse: TODO_RESPONSE });
    await waitFor(() => expect(route.getPathname()).toBe('/loading'));
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalled());

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('포그라운드 탭: 읽음 응답 뒤 피드 위로 이동한다', async () => {
    // Given
    const read = createPendingResponse(READ_OK);
    const { route, gateway } = await setup({
      status: 'authenticated',
      markRead: () => read.response,
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    expect(route.getPathname()).toBe('/feed');

    // When
    await act(async () => read.settle());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('로그아웃 상태 탭: 보관했다가 로그인 뒤 한 번만 이동한다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, gateway, httpClient } = await setup({ status: 'unauthenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/login'));
    await act(async () => gateway.emitResponse(TODO_RESPONSE));
    expect(httpClient.patch).not.toHaveBeenCalled();

    // When
    await user.press(screen.getByRole('button', { name: 'login' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });

  it('다른 계정 알림: 읽음이 404면 버리고 피드에 머문다', async () => {
    // Given
    const { route, gateway } = await setup({
      status: 'authenticated',
      markRead: async () => err(new ApiError('NOTIFICATION_1001', '없어요', 404)),
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    await waitFor(() => expect(gateway.clearLastResponse).toHaveBeenCalled());
    expect(route.getPathname()).toBe('/feed');
  });

  it('오프라인: 읽음을 확인하지 못해도 바로 이동하고 opened를 기록한다', async () => {
    // Given
    const { route, gateway, httpClient } = await setup({
      status: 'authenticated',
      markRead: async () => {
        throw new NetworkError();
      },
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledWith('v1/notifications/7/opened'));
    expect(gateway.getLastResponse()).toBeNull();
  });

  it('서버가 답이 없어도 읽음 예산이 지나면 이동한다', async () => {
    // Given
    const { route, gateway } = await setup({
      status: 'authenticated',
      markRead: () => new Promise(noop),
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    expect(route.getPathname()).toBe('/feed');
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'), {
      timeout: NOTIFICATION_READ_BUDGET_MS + 1000,
    });
  });

  it('로그아웃하면 진행 중인 읽음이 끝나도 이동하지 않고 마지막 응답을 지운다', async () => {
    // Given
    const user = userEvent.setup();
    const read = createPendingResponse(READ_OK);
    const { route, gateway } = await setup({
      status: 'authenticated',
      markRead: () => read.response,
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // When
    await user.press(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(route.getPathname()).toBe('/login'));
    await act(async () => read.settle());

    // Then
    expect(route.getPathname()).toBe('/login');
    expect(gateway.getLastResponse()).toBeNull();
  });

  it('연속 두 탭: 마지막 탭만 열고 뒤로 가면 피드다', async () => {
    // Given
    const user = userEvent.setup();
    const { route, gateway } = await setup({ status: 'loading' });
    await act(async () => gateway.emitResponse(TODO_RESPONSE));
    await act(async () => gateway.emitResponse(SECOND_TODO_RESPONSE));

    // When
    await user.press(screen.getByRole('button', { name: 'boot-authenticated' }));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/43'));
    await act(() => router.back());
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
  });

  it('포그라운드에서 연속 두 탭: 앞 탭의 읽음 응답이 늦어도 마지막 탭만 연다', async () => {
    // Given
    const firstRead = createPendingResponse(READ_OK);
    const { route, gateway, httpClient, analytics } = await setup({ status: 'authenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    httpClient.patch.mockImplementationOnce(() => firstRead.response);
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // When
    await act(async () => gateway.emitResponse(SECOND_TODO_RESPONSE));
    await waitFor(() => expect(route.getPathname()).toBe('/todo/43'));
    await act(async () => firstRead.settle());

    // Then
    expect(route.getPathname()).toBe('/todo/43');
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
  });

  it('모르는 타입: navigation이 없으면 알림 목록으로 간다', async () => {
    // Given
    const { route, gateway, analytics } = await setup({ status: 'authenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () =>
      gateway.emitResponse({
        ...TODO_RESPONSE,
        data: { notificationId: 7, type: 'NEW_KIND', action: { type: 'DEEP_LINK' } },
      }),
    );

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/notifications'));
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'push_notification_opened',
      expect.objectContaining({ type: 'UNKNOWN', action: 'DEEP_LINK' }),
    );
  });

  it('모르는 타입: navigation이 있으면 그 목적지로 간다', async () => {
    // Given
    const { route, gateway } = await setup({ status: 'authenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () =>
      gateway.emitResponse({
        ...TODO_RESPONSE,
        data: {
          notificationId: 7,
          type: 'NEW_KIND',
          action: { type: 'DEEP_LINK' },
          navigation: { kind: 'TODO', todoId: 42 },
        },
      }),
    );

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('수신 거부 버튼: 실패하면 다음 탭에 밀리지 않고 포그라운드로 돌아올 때 다시 보낸다', async () => {
    // Given
    const { route, gateway, httpClient, appLifecycle } = await setup({ status: 'authenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    httpClient.post.mockRejectedValueOnce(new NetworkError());
    httpClient.post.mockResolvedValue(
      ok({ optedOut: true, marketingPushWithdrawnAt: '2026-11-09T03:00:00.000Z' }),
    );

    // When
    await act(async () =>
      gateway.emitResponse({
        ...TODO_RESPONSE,
        id: 'opt-out',
        actionIdentifier: 'MARKETING_OPT_OUT',
        data: { ...TODO_RESPONSE.data, marketingOptOutToken: 'token-1' },
      }),
    );
    await act(async () => gateway.emitResponse(SECOND_TODO_RESPONSE));
    await waitFor(() => expect(route.getPathname()).toBe('/todo/43'));
    await act(async () => appLifecycle.emit('active'));

    // Then
    await waitFor(() =>
      expect(
        httpClient.post.mock.calls.filter(
          ([url]) => url === 'v1/notifications/marketing-push/opt-out',
        ),
      ).toHaveLength(2),
    );
  });

  it('수신 거부 버튼: 로그인 없이 처리하고 이동하지 않는다', async () => {
    // Given
    const { route, gateway, httpClient } = await setup({ status: 'unauthenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/login'));
    httpClient.post.mockResolvedValue(
      ok({ optedOut: true, marketingPushWithdrawnAt: '2026-11-09T03:00:00.000Z' }),
    );

    // When
    await act(async () =>
      gateway.emitResponse({
        ...TODO_RESPONSE,
        actionIdentifier: 'MARKETING_OPT_OUT',
        data: { ...TODO_RESPONSE.data, marketingOptOutToken: 'token-1' },
      }),
    );

    // Then
    await waitFor(() =>
      expect(httpClient.post).toHaveBeenCalledWith('v1/notifications/marketing-push/opt-out', {
        token: 'token-1',
      }),
    );
    expect(
      await screen.findAllByText('2026년 11월 9일에 아이두 광고성 앱 푸시 수신 동의를 철회했어요'),
    ).not.toHaveLength(0);
    expect(route.getPathname()).toBe('/login');
    expect(httpClient.patch).not.toHaveBeenCalled();
    await waitFor(() => expect(gateway.clearLastResponse).toHaveBeenCalled());
  });
});
