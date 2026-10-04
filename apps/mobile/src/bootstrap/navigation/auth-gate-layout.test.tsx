import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ExpoLinking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { createContext, type PropsWithChildren, use, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import RootIndex from '../../../app/index';
import { AuthGateLayout } from './auth-gate-layout';

jest.mock('@src/bootstrap/providers/auth-provider', () => ({ useAuth: jest.fn() }));
jest.mock('@src/shared/hooks/use-screen-tracking', () => ({ useScreenTracking: jest.fn() }));
jest.mock('@src/bootstrap/hooks/use-user-identity', () => ({ useUserIdentity: jest.fn() }));
jest.mock('@src/bootstrap/providers/di-context', () => {
  const errorReporter = { addBreadcrumb: jest.fn(), captureException: jest.fn() };
  const repository = {
    subscribe: () => () => {},
    getPendingCommand: () => null,
    clearIfCurrent: () => false,
  };
  return {
    useErrorReporter: () => errorReporter,
    useWidgetNavigationRepository: () => repository,
  };
});
jest.mock('@src/features/user/presentations/queries/get-me-query-options', () => ({
  useGetMeQueryOptions: () => ({
    queryKey: ['user', 'me'],
    queryFn: async () => ({ id: 'test-account' }),
    staleTime: Infinity,
  }),
}));
jest.mock('@src/shared/providers/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));
jest.mock('uniwind', () => ({ useResolveClassNames: () => ({ backgroundColor: '#ffffff' }) }));
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  useLinkingURL: jest.fn(() => null),
}));

type AuthState = ReturnType<typeof useAuth>;
const AuthContext = createContext<AuthState | null>(null);

function useTestAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('Auth fixture missing');
  return value;
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
  return (
    <Pressable testID="feed" onPress={() => setStatus('unauthenticated')}>
      <Text>Feed</Text>
    </Pressable>
  );
}

function LoadingScreen() {
  const { setStatus } = useTestAuth();
  return (
    <View>
      <Pressable testID="boot-authenticated" onPress={() => setStatus('authenticated')}>
        <Text>Restore session</Text>
      </Pressable>
      <Pressable testID="boot-unauthenticated" onPress={() => setStatus('unauthenticated')}>
        <Text>No session</Text>
      </Pressable>
    </View>
  );
}

async function renderAuthRoutes(initialStatus: AuthState['status'], initialUrl = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  function AuthFixture({ children }: PropsWithChildren) {
    const [status, setStatus] = useState(initialStatus);
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext value={{ status, setStatus }}>{children}</AuthContext>
      </QueryClientProvider>
    );
  }

  jest.mocked(useAuth).mockImplementation(useTestAuth);

  const route = renderRouter(
    {
      _layout: AuthGateLayout,
      index: RootIndex,
      loading: LoadingScreen,
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
  await route;
  return { getPathname: () => route.getPathname() };
}

describe('root 인증 route 전환', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it.each(['loading', 'locked'] as const)(
    '%s 상태에서 복원 전에는 loading을 유지한다',
    async (status) => {
      const route = await renderAuthRoutes(status);

      expect(route.getPathname()).toBe('/loading');
      expect(screen.queryByTestId('login')).toBeNull();
      expect(screen.queryByTestId('feed')).toBeNull();
    },
  );

  it('세션 없는 부팅은 login으로 이동한다', async () => {
    const route = await renderAuthRoutes('loading');

    await fireEvent.press(screen.getByTestId('boot-unauthenticated'));

    expect(route.getPathname()).toBe('/login');
  });

  it('세션 복원은 index가 없는 탭 그룹의 feed로 이동한다', async () => {
    const route = await renderAuthRoutes('loading');

    await fireEvent.press(screen.getByTestId('boot-authenticated'));

    expect(route.getPathname()).toBe('/feed');
    expect(screen.getByTestId('feed')).toBeTruthy();
  });

  it('로그인 후 feed, 로그아웃 후 login으로 이동한다', async () => {
    const route = await renderAuthRoutes('unauthenticated');

    await fireEvent.press(screen.getByTestId('login'));
    expect(route.getPathname()).toBe('/feed');

    await fireEvent.press(screen.getByTestId('feed'));
    expect(route.getPathname()).toBe('/login');
  });

  it('인증된 재실행의 root는 feed로 이동한다', async () => {
    const route = await renderAuthRoutes('authenticated');

    expect(route.getPathname()).toBe('/feed');
  });

  it('미인증 사용자의 private URL은 login으로 이동한다', async () => {
    const route = await renderAuthRoutes('unauthenticated', '/feed');

    expect(route.getPathname()).toBe('/login');
  });

  it('위젯의 초기 할 일 링크를 세션 복원과 인증 영역 마운트 뒤 복원한다', async () => {
    // Given: 인증 복원 중 초기 위젯 링크가 들어온다
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('aido-dev://todo/8');
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue('aido-dev://todo/8');
    const route = await renderAuthRoutes('loading', '/todo/8');
    expect(route.getPathname()).toBe('/loading');

    // When: 저장된 세션 복원을 마친다
    await fireEvent.press(screen.getByTestId('boot-authenticated'));

    // Then: 피드로 유실되지 않고 대상 상세에 한 번 도착한다
    expect(await screen.findByTestId('todo-detail')).toBeTruthy();
    expect(route.getPathname()).toBe('/todo/8');
    expect(useErrorReporter().addBreadcrumb).toHaveBeenCalledWith({
      category: 'widget',
      message: 'initial widget destination restored',
    });
  });

  it('인증 복원 중 받은 최신 위젯 링크가 이전 초기 링크보다 우선한다', async () => {
    // Given
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue('aido-dev://feed?date=today');
    const route = await renderAuthRoutes('loading');

    // When
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue('aido-dev://todo/9');
    await fireEvent.press(screen.getByTestId('boot-authenticated'));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/todo/9'));
  });

  it('종료된 앱의 상세 링크에서 뒤로가면 피드로 돌아가고 상세가 다시 열리지 않는다', async () => {
    // Given
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue('aido-dev://todo/8');
    const route = await renderAuthRoutes('loading', '/todo/8');
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
    const route = await renderAuthRoutes('unauthenticated', '/todo/8');

    // When
    await fireEvent.press(screen.getByTestId('login'));

    // Then
    await waitFor(() => expect(route.getPathname()).toBe('/feed'));
  });
});
