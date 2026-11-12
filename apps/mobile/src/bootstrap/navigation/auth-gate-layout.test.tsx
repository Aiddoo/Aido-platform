import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { ok } from '@src/core/errors/result';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createWidgetNavigationRepository } from '@src/features/device/widget/repositories/widget-navigation.repository';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { ThemeProvider } from '@src/shared/providers/theme-provider';
import {
  createHttpClientStub,
  createTestDi,
  createMemoryObservableSyncStorage,
  createTestQueryClient,
} from '@src/testing/core';
import { TestUiProvider } from '@src/testing/render';
import { QueryClientProvider } from '@tanstack/react-query';
import * as ExpoLinking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { PropsWithChildren } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import RootIndex from '../../../app/index';
import * as orientationLock from '../hooks/use-orientation-lock';
import { AuthGateLayout } from './auth-gate-layout';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

let mockAuthSessionStore = createAuthSessionStoreStub('loading');
function LoginScreen() {
  return (
    <Pressable testID="login" onPress={() => mockAuthSessionStore.setStatus('authenticated')}>
      <Text>Login</Text>
    </Pressable>
  );
}

function FeedScreen() {
  return (
    <Pressable testID="feed" onPress={() => mockAuthSessionStore.setStatus('unauthenticated')}>
      <Text>Feed</Text>
    </Pressable>
  );
}

function LoadingScreen() {
  return (
    <View>
      <Pressable
        testID="boot-authenticated"
        onPress={() => mockAuthSessionStore.setStatus('authenticated')}
      >
        <Text>Restore session</Text>
      </Pressable>
      <Pressable
        testID="boot-unauthenticated"
        onPress={() => mockAuthSessionStore.setStatus('unauthenticated')}
      >
        <Text>No session</Text>
      </Pressable>
    </View>
  );
}

async function renderAuthRoutes(initialStatus: AuthStatus, initialUrl = '/') {
  const queryClient = createTestQueryClient();
  mockAuthSessionStore = createAuthSessionStoreStub(initialStatus);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async () => ok(createCurrentUserDto()));
  const container = createTestDi({
    httpClient,
    widgetNavigationRepository: createWidgetNavigationRepository(
      createMemoryObservableSyncStorage(),
    ),
    authSessionStore: mockAuthSessionStore,
  });
  function AuthFixture({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <StaticDIProvider container={container}>
          <ThemeProvider syncStorage={createMemoryObservableSyncStorage()}>
            <TestUiProvider>
              <LocalDateProvider>{children}</LocalDateProvider>
            </TestUiProvider>
          </ThemeProvider>
        </StaticDIProvider>
      </QueryClientProvider>
    );
  }

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
      '(app)/todo/[todoId]/index': () => <Text testID="todo-detail">Todo details</Text>,
    },
    { initialUrl, wrapper: AuthFixture },
  );
  return { route, errorReporter: container.errorReporter };
}

describe('root 인증 route 전환', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  it.each(['loading', 'locked'] as const)(
    '%s 상태에서 복원 전에는 loading을 유지한다',
    async (status) => {
      // Given·When
      const { route } = await renderAuthRoutes(status);

      // Then
      expect(route.getPathname()).toBe('/loading');
      expect(screen.queryByTestId('login')).toBeNull();
      expect(screen.queryByTestId('feed')).toBeNull();
    },
  );

  it('세션 없는 부팅은 login으로 이동한다', async () => {
    // Given
    const { route } = await renderAuthRoutes('loading');

    // When
    await fireEvent.press(screen.getByTestId('boot-unauthenticated'));

    // Then
    expect(route.getPathname()).toBe('/login');
  });

  it('세션 복원은 index가 없는 탭 그룹의 feed로 이동한다', async () => {
    // Given
    const { route } = await renderAuthRoutes('loading');

    // When
    await fireEvent.press(screen.getByTestId('boot-authenticated'));

    // Then
    expect(route.getPathname()).toBe('/feed');
    expect(screen.getByTestId('feed')).toBeTruthy();
  });

  it('로그인 후 feed, 로그아웃 후 login으로 이동한다', async () => {
    // Given
    const { route } = await renderAuthRoutes('unauthenticated');

    // When
    await fireEvent.press(screen.getByTestId('login'));

    // Then
    expect(route.getPathname()).toBe('/feed');

    // When
    await fireEvent.press(screen.getByTestId('feed'));

    // Then
    expect(route.getPathname()).toBe('/login');
  });

  it('인증된 재실행의 root는 feed로 이동한다', async () => {
    // Given·When
    const { route } = await renderAuthRoutes('authenticated');

    // Then
    expect(route.getPathname()).toBe('/feed');
  });

  it('미인증 사용자의 private URL은 login으로 이동한다', async () => {
    // Given·When
    const { route } = await renderAuthRoutes('unauthenticated', '/feed');

    // Then
    expect(route.getPathname()).toBe('/login');
  });

  it('위젯의 초기 할 일 링크를 세션 복원과 인증 영역 마운트 뒤 복원한다', async () => {
    // Given
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('aido-dev://todo/8');
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue('aido-dev://todo/8');
    const { route, errorReporter } = await renderAuthRoutes('loading', '/todo/8');
    expect(route.getPathname()).toBe('/loading');

    // When
    await fireEvent.press(screen.getByTestId('boot-authenticated'));

    // Then
    expect(await screen.findByTestId('todo-detail')).toBeTruthy();
    expect(route.getPathname()).toBe('/todo/8');
    expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith({
      category: 'widget',
      message: 'initial widget destination restored',
    });
  });

  it('인증 복원 중 받은 최신 위젯 링크가 이전 초기 링크보다 우선한다', async () => {
    // Given
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue('aido-dev://feed?date=today');
    const { route } = await renderAuthRoutes('loading');

    // When
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue('aido-dev://todo/9');
    await fireEvent.press(screen.getByTestId('boot-authenticated'));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/9'));
  });

  it('종료된 앱의 상세 링크에서 뒤로가면 피드로 돌아가고 상세가 다시 열리지 않는다', async () => {
    // Given
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue('aido-dev://todo/8');
    const { route } = await renderAuthRoutes('loading', '/todo/8');
    await fireEvent.press(screen.getByTestId('boot-authenticated'));
    await waitFor(() => expect(route.getPathname()).toBe('/todo/8'));

    // When
    await act(() => router.back());

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
  });

  it('미인증으로 확정된 초기 링크는 이후 로그인에 다시 적용하지 않는다', async () => {
    // Given
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue('aido-dev://todo/8');
    const { route } = await renderAuthRoutes('unauthenticated', '/todo/8');

    // When
    await fireEvent.press(screen.getByTestId('login'));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
  });

  it('화면 params가 바뀌어도 루트 레이아웃은 다시 그리지 않는다', async () => {
    // Given
    // 레이아웃 몸체에서만 부르는 훅의 호출 수가 레이아웃을 그린 횟수다
    const layoutRender = jest.spyOn(orientationLock, 'useOrientationLock');
    const { route } = await renderAuthRoutes('authenticated');
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
    const rendersBefore = layoutRender.mock.calls.length;
    expect(rendersBefore).toBeGreaterThan(0);

    // When
    await act(() => router.setParams({ date: '2026-11-12' }));
    await act(() => router.setParams({ date: '2026-11-13' }));

    // Then
    expect(route.getPathnameWithParams()).toBe('/feed?date=2026-11-13');
    expect(layoutRender).toHaveBeenCalledTimes(rendersBefore);
  });
});
