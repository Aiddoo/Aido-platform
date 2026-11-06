import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import {
  createMarkReadResponseDto,
  createPushNotificationGatewayStub,
} from '@src/features/notification/__tests__/notification.fixtures';
import { createStubInviteService } from '@src/features/social/invite/__tests__/create-stub-invite-service';
import {
  createHttpClientStub,
  createTestDiContainer,
  mockWindowDimensions,
} from '@src/shared/__tests__';
import { createPendingResponse } from '@src/shared/__tests__/create-pending-response';
import { createTestDi } from '@src/shared/__tests__/create-test-di';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { ApiError, NetworkError } from '@src/shared/errors';
import { err, ok, type Result } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { QueryClientProvider } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import * as ExpoLinking from 'expo-linking';
import { router, Stack, useFocusEffect } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { createContext, type PropsWithChildren, use, useCallback, useState } from 'react';
import { AppState, type AppStateStatus, Linking, Pressable, Text } from 'react-native';

import RootIndex from '../../../app/index';
import { AuthGateLayout } from './auth-gate-layout';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

jest.mock('@src/bootstrap/providers/auth-provider', () => ({ useAuth: jest.fn() }));
jest.mock('@src/shared/hooks/use-screen-tracking', () => ({ useScreenTracking: jest.fn() }));
jest.mock('@src/bootstrap/hooks/use-user-identity', () => ({ useUserIdentity: jest.fn() }));
jest.mock('@src/shared/providers/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));
jest.mock('uniwind', () => ({ useResolveClassNames: () => ({ backgroundColor: '#ffffff' }) }));
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  useLinkingURL: jest.fn(() => null),
}));
jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(async () => {}),
  preventAutoHideAsync: jest.fn(async () => {}),
}));

type AuthState = ReturnType<typeof useAuth>;
const AuthContext = createContext<AuthState | null>(null);

function useTestAuth() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('Auth fixture missing');
  }
  return value;
}

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
  status: AuthState['status'];
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
  const focusLog: string[] = [];
  const hideLog: string[] = [];

  function LoadingScreen() {
    const { setStatus } = useTestAuth();
    return (
      <Pressable testID="boot-authenticated" onPress={() => setStatus('authenticated')}>
        <Text>Restore session</Text>
      </Pressable>
    );
  }

  function LoginScreen() {
    const { setStatus } = useTestAuth();
    return (
      <Pressable testID="login" onPress={() => setStatus('authenticated')}>
        <Text>Login</Text>
      </Pressable>
    );
  }

  function FeedScreen() {
    const { setStatus } = useTestAuth();
    useFocusEffect(
      useCallback(() => {
        focusLog.push('feed');
      }, []),
    );
    return (
      <Pressable testID="logout" onPress={() => setStatus('unauthenticated')}>
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

  const queryClient = createTestQueryClient();
  const container = createTestDiContainer(
    createTestDi({
      httpClient,
      pushNotificationGateway: gateway,
      inviteService: createStubInviteService(),
      widgetNavigationRepository: {
        subscribe: () => () => {},
        getPendingCommand: () => null,
        clearIfCurrent: () => false,
        store: () => true,
      },
    }),
  );

  function Fixture({ children }: PropsWithChildren) {
    const [authStatus, setStatus] = useState(status);
    return (
      <QueryClientProvider client={queryClient}>
        <StaticDIProvider container={container}>
          <LocalDateProvider>
            <AuthContext value={{ status: authStatus, setStatus }}>{children}</AuthContext>
          </LocalDateProvider>
        </StaticDIProvider>
      </QueryClientProvider>
    );
  }

  jest.mocked(useAuth).mockImplementation(useTestAuth);

  const route = await renderRouter(
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
    { initialUrl, wrapper: Fixture },
  );

  jest.mocked(SplashScreen.hideAsync).mockImplementation(async () => {
    hideLog.push(route.getPathname());
  });

  return { route, gateway, httpClient, focusLog, hideLog, analytics: container.analytics };
}

describe('푸시 탭 진입 (지금 동작)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindowDimensions(390);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('앱 종료 상태 탭: 스플래시가 먼저 내려가고 피드가 focus된 뒤 읽음 응답을 기다려 목적지로 간다', async () => {
    // Given
    const read = createPendingResponse(READ_OK);
    const { route, gateway, focusLog, hideLog } = await setup({
      status: 'loading',
      lastResponse: TODO_RESPONSE,
      markRead: () => read.response,
    });
    expect(route.getPathname()).toBe('/loading');

    // When
    await fireEvent.press(screen.getByTestId('boot-authenticated'));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(hideLog).toEqual(['/loading']);
    expect(focusLog).toEqual(['feed']);

    // When
    await act(async () => read.settle());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
    expect(focusLog).toEqual(['feed', 'todo']);
    expect(gateway.clearLastResponse).toHaveBeenCalled();
  });

  it('앱 종료 상태 탭: 뒤로 가면 피드이고 다시 이동하지 않는다', async () => {
    // Given
    const { route, gateway } = await setup({ status: 'loading', lastResponse: TODO_RESPONSE });
    await fireEvent.press(screen.getByTestId('boot-authenticated'));
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));

    // When
    await act(() => router.back());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    expect(gateway.getLastResponse()).toBeNull();
  });

  it('잠금 중 콜드 스타트: 스피너로 넘겼다가 잠금이 풀리면 이동한다', async () => {
    // Given
    const { route } = await setup({ status: 'locked', lastResponse: TODO_RESPONSE });
    await waitFor(() => expect(route.getPathname()).toBe('/loading'));
    expect(SplashScreen.hideAsync).toHaveBeenCalled();

    // When
    await fireEvent.press(screen.getByTestId('boot-authenticated'));

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
    const { route, gateway, httpClient } = await setup({ status: 'unauthenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/login'));
    await act(async () => gateway.emitResponse(TODO_RESPONSE));
    expect(httpClient.patch).not.toHaveBeenCalled();

    // When
    await fireEvent.press(screen.getByTestId('login'));

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

  it('오프라인: 이동하지 않고 포그라운드로 돌아올 때 다시 시도한다', async () => {
    // Given
    const appStateListeners: Array<(state: AppStateStatus) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListeners.push(listener);
      return { remove: noop };
    });
    let isOnline = false;
    const { route, gateway, httpClient } = await setup({
      status: 'authenticated',
      markRead: async () => {
        if (!isOnline) {
          throw new NetworkError();
        }
        return READ_OK;
      },
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));

    // When
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    expect(route.getPathname()).toBe('/feed');

    // When
    isOnline = true;
    await act(async () => {
      appStateListeners.forEach((listener) => listener('active'));
    });

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/42'));
  });

  it('로그아웃하면 진행 중인 읽음이 끝나도 이동하지 않고 마지막 응답을 지운다', async () => {
    // Given
    const read = createPendingResponse(READ_OK);
    const { route, gateway } = await setup({
      status: 'authenticated',
      markRead: () => read.response,
    });
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    await act(async () => gateway.emitResponse(TODO_RESPONSE));

    // When
    await fireEvent.press(screen.getByTestId('logout'));
    await waitFor(() => expect(route.getPathname()).toBe('/login'));
    await act(async () => read.settle());

    // Then
    expect(route.getPathname()).toBe('/login');
    expect(gateway.getLastResponse()).toBeNull();
  });

  it('연속 두 탭: 마지막 탭만 열고 뒤로 가면 피드다', async () => {
    // Given
    const { route, gateway } = await setup({ status: 'loading' });
    await act(async () => gateway.emitResponse(TODO_RESPONSE));
    await act(async () => gateway.emitResponse(SECOND_TODO_RESPONSE));

    // When
    await fireEvent.press(screen.getByTestId('boot-authenticated'));

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

  it('수신 거부 버튼: 로그인 없이 처리하고 이동하지 않는다', async () => {
    // Given
    const { route, gateway, httpClient } = await setup({ status: 'unauthenticated' });
    await waitFor(() => expect(route.getPathname()).toBe('/login'));
    httpClient.post.mockResolvedValue(ok({ optedOut: true }));

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
    expect(route.getPathname()).toBe('/login');
    expect(httpClient.patch).not.toHaveBeenCalled();
    await waitFor(() => expect(gateway.clearLastResponse).toHaveBeenCalled());
  });
});
