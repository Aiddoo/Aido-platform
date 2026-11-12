import { ok } from '@src/core/errors/result';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { getCachedMe, updateMeInCache } from '@src/features/identity/user/queries/user-cache';
import { useFeedTodoDetailHandoff } from '@src/features/planning/todo/hooks/use-feed-selected-todo-id';
import { useTrackView } from '@src/shared/analytics';
import * as themeProvider from '@src/shared/providers/theme-provider';
import type { ScreenName } from '@src/shared/utils/to-screen-name';
import { createAnalyticsStub, createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import * as ExpoLinking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Dimensions, Linking, Pressable, Text, View } from 'react-native';

import OAuthCallbackScreen from '../../../app/auth/[provider]';
import RootIndex from '../../../app/index';
import { AuthGateLayout } from './auth-gate-layout';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

let mockAuthSessionStore = createAuthSessionStoreStub('loading');

/** 화면이 마운트될 때 보기를 한 번 센다. 화면 진입 이벤트 자리에 이벤트 하나를 빌려 쓴다 */
function useMountedView(screenName: ScreenName) {
  useTrackView('view_tab_changed', {
    key: 'mounted',
    params: { screen_name: screenName, view: 'mounted' },
  });
}

function LoginScreen() {
  return (
    <Pressable testID="login" onPress={() => mockAuthSessionStore.setStatus('authenticated')}>
      <Text>Login</Text>
    </Pressable>
  );
}

function FeedScreen() {
  useMountedView('/feed');
  useFeedTodoDetailHandoff();

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

function TodoDetailScreen() {
  useMountedView('/todo/[todoId]');

  return <Text testID="todo-detail">Todo details</Text>;
}

function TodoActionsSheet() {
  useMountedView('/todo/[todoId]/actions');

  return null;
}

async function renderAuthRoutes(initialStatus: AuthStatus, initialUrl = '/') {
  mockAuthSessionStore = createAuthSessionStoreStub(initialStatus);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async () => ok(createCurrentUserDto()));
  const analytics = createAnalyticsStub();
  const di = createTestDi({
    ports: { httpClient, analytics },
    seeds: { authSessionStore: mockAuthSessionStore },
  });

  const route = await renderAppRoute(
    {
      _layout: AuthGateLayout,
      index: RootIndex,
      loading: LoadingScreen,
      'auth/[provider]': OAuthCallbackScreen,
      'invite/index': () => <Text>Invite</Text>,
      '(auth)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
      '(auth)/login': LoginScreen,
      '(app)/_layout': {
        default: () => <Stack screenOptions={{ animation: 'none' }} />,
        unstable_settings: { anchor: '(tabs)' },
      },
      '(app)/(tabs)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
      '(app)/(tabs)/feed/index': FeedScreen,
      '(app)/todo/[todoId]/index': TodoDetailScreen,
      '(app)/todo/[todoId]/actions': TodoActionsSheet,
    },
    { url: initialUrl, di, withLocalDate: true },
  );
  const screenViews = () => analytics.trackScreenView.mock.calls.map(([name]) => name);
  // 화면 조회와 마운트 보기를 보낸 순서대로 놓는다. Firebase는 이벤트에 마지막 screen_view의 화면 이름을 붙인다
  const timeline = () =>
    [
      ...analytics.trackScreenView.mock.calls.map(([name], index) => ({
        order: analytics.trackScreenView.mock.invocationCallOrder[index] ?? 0,
        entry: `screen ${name}`,
      })),
      ...analytics.trackEvent.mock.calls.map(([, params], index) => ({
        order: analytics.trackEvent.mock.invocationCallOrder[index] ?? 0,
        entry: `view ${String(params?.screen_name)}`,
      })),
    ]
      .sort((a, b) => a.order - b.order)
      .map(({ entry }) => entry);
  return {
    route,
    errorReporter: di.errorReporter,
    queryClient: di.queryClient,
    screenViews,
    timeline,
  };
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

  describe('화면 조회', () => {
    it('콜드 스타트는 스플래시 뒤 입구 화면을 세지 않고 첫 화면만 센다', async () => {
      // Given
      const { route, screenViews } = await renderAuthRoutes('loading');

      // When
      await fireEvent.press(screen.getByTestId('boot-authenticated'));

      // Then
      expect(route.getPathname()).toBe('/feed');
      expect(screenViews()).toEqual(['/feed']);
    });

    it('로그인과 로그아웃은 Index를 거쳐도 도착한 화면만 센다', async () => {
      // Given
      const { screenViews } = await renderAuthRoutes('unauthenticated');

      // When
      await fireEvent.press(screen.getByTestId('login'));
      await fireEvent.press(screen.getByTestId('feed'));

      // Then
      expect(screenViews()).toEqual(['/login', '/feed', '/login']);
    });

    it('Android OAuth 콜백 route는 세지 않는다', async () => {
      // Given·When
      const { route, screenViews } = await renderAuthRoutes('authenticated', '/auth/google');

      // Then
      await waitFor(() => expect(route.getPathname()).toBe('/feed'));
      expect(screenViews()).toEqual(['/feed']);
    });
  });

  describe('보기 추적', () => {
    async function renderFeed() {
      const rendered = await renderAuthRoutes('authenticated');
      await waitFor(() => expect(rendered.route.getPathname()).toBe('/feed'));
      return rendered;
    }

    it('상세에 갔다 돌아오면 피드를 다시 세고 피드 마운트 보기는 다시 세지 않는다', async () => {
      // Given
      const { timeline } = await renderFeed();

      // When
      await act(() => router.push({ pathname: '/todo/[todoId]', params: { todoId: 1 } }));
      await act(() => router.back());

      // Then
      expect(timeline()).toEqual([
        'screen /feed',
        'view /feed',
        'screen /todo/[todoId]',
        'view /todo/[todoId]',
        'screen /feed',
      ]);
    });

    it('시트 route는 열 때마다 시트 조회 뒤 시트 보기를 한 번 세고 닫으면 아래 화면을 센다', async () => {
      // Given
      const { timeline } = await renderFeed();
      const openSheet = () =>
        act(() => router.push({ pathname: '/todo/[todoId]/actions', params: { todoId: 1 } }));

      // When
      await openSheet();
      await act(() => router.back());
      await openSheet();

      // Then
      expect(timeline().slice(2)).toEqual([
        'screen /todo/[todoId]/actions',
        'view /todo/[todoId]/actions',
        'screen /feed',
        'screen /todo/[todoId]/actions',
        'view /todo/[todoId]/actions',
      ]);
    });

    it('query만 바뀌면 화면을 다시 세지 않는다', async () => {
      // Given
      const { screenViews } = await renderFeed();

      // When
      await act(() => router.setParams({ date: '2026-11-12' }));

      // Then
      expect(screenViews()).toEqual(['/feed']);
    });
  });

  describe('넓은 화면 칸의 상세', () => {
    const window = Dimensions.get('window');
    const screenSize = Dimensions.get('screen');
    const setWindowWidth = (width: number) =>
      Dimensions.set({ window: { ...window, width }, screen: screenSize });

    beforeEach(() => {
      setWindowWidth(1024);
    });

    afterEach(() => {
      Dimensions.set({ window, screen: screenSize });
    });

    async function renderWideFeed() {
      const rendered = await renderAuthRoutes('authenticated');
      await waitFor(() => expect(rendered.route.getPathname()).toBe('/feed'));
      return rendered;
    }

    it('칸에서 고른 상세를 좁은 화면의 상세 이름으로 세고, 칸을 닫거나 query만 바꾸면 세지 않는다', async () => {
      // Given
      const { screenViews } = await renderWideFeed();

      // When
      await act(() => router.setParams({ todoId: '8' }));
      await act(() => router.setParams({ date: '2026-11-12' }));
      await act(() => router.setParams({ todoId: '9' }));
      await act(() => router.setParams({ todoId: undefined }));

      // Then
      expect(screenViews()).toEqual(['/feed', '/todo/[todoId]', '/todo/[todoId]']);
    });

    it('칸에 상세를 연 채 접으면 상세 화면으로 넘겨도 다시 세지 않고 뒤로 가면 목록을 센다', async () => {
      // Given
      const { route, screenViews } = await renderWideFeed();
      await act(() => router.setParams({ todoId: '8' }));

      // When
      await act(() => setWindowWidth(390));
      await waitFor(() => expect(route.getPathname()).toBe('/todo/8'));
      await act(() => router.back());

      // Then
      expect(screenViews()).toEqual(['/feed', '/todo/[todoId]', '/feed']);
    });
  });

  describe('루트 레이아웃 다시 그리기', () => {
    // 레이아웃 몸체에서만 부르는 훅의 호출 수가 레이아웃을 그린 횟수다
    async function renderFeedAndCountLayout() {
      const layoutRender = jest.spyOn(themeProvider, 'useAppTheme');
      const rendered = await renderAuthRoutes('authenticated');
      await waitFor(() => expect(rendered.route.getPathname()).toBe('/feed'));
      const rendersBefore = layoutRender.mock.calls.length;
      expect(rendersBefore).toBeGreaterThan(0);
      return { ...rendered, layoutRender, rendersBefore };
    }

    it('화면 params가 바뀌어도 다시 그리지 않는다', async () => {
      // Given
      const { route, layoutRender, rendersBefore } = await renderFeedAndCountLayout();

      // When
      await act(() => router.setParams({ date: '2026-11-12' }));
      await act(() => router.setParams({ date: '2026-11-13' }));

      // Then
      expect(route.getPathnameWithParams()).toBe('/feed?date=2026-11-13');
      expect(layoutRender).toHaveBeenCalledTimes(rendersBefore);
    });

    it('내 정보가 바뀌어도 다시 그리지 않는다', async () => {
      // Given
      const { queryClient, layoutRender, rendersBefore } = await renderFeedAndCountLayout();

      // When
      await act(async () => {
        updateMeInCache(queryClient, (me) => ({ ...me, name: '새 이름' }));
        // renderRouter가 fake timer를 켜 TanStack의 구독자 알림(setTimeout 0)을 직접 흘린다
        jest.advanceTimersByTime(0);
      });

      // Then
      expect(getCachedMe(queryClient)?.name).toBe('새 이름');
      expect(layoutRender).toHaveBeenCalledTimes(rendersBefore);
    });

    it('창 크기가 바뀌어도 다시 그리지 않는다', async () => {
      // Given
      const window = Dimensions.get('window');
      const screenSize = Dimensions.get('screen');
      const { layoutRender, rendersBefore } = await renderFeedAndCountLayout();

      // When
      try {
        await act(() =>
          Dimensions.set({ window: { ...window, width: window.width + 200 }, screen: screenSize }),
        );
      } finally {
        Dimensions.set({ window, screen: screenSize });
      }

      // Then
      expect(layoutRender).toHaveBeenCalledTimes(rendersBefore);
    });
  });
});
