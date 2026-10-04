import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { createContext, type PropsWithChildren, use, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import RootIndex from '../../../app/index';
import { AuthGateLayout } from './auth-gate-layout';

jest.mock('@src/bootstrap/providers/auth-provider', () => ({ useAuth: jest.fn() }));
jest.mock('@src/shared/hooks/use-screen-tracking', () => ({ useScreenTracking: jest.fn() }));
jest.mock('@src/bootstrap/hooks/use-user-identity', () => ({ useUserIdentity: jest.fn() }));
jest.mock('@src/bootstrap/providers/di-context', () => {
  const errorReporter = { addBreadcrumb: jest.fn(), captureException: jest.fn() };
  return { useErrorReporter: () => errorReporter };
});
jest.mock('@src/shared/providers/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));
jest.mock('uniwind', () => ({ useResolveClassNames: () => ({ backgroundColor: '#ffffff' }) }));

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
  function AuthFixture({ children }: PropsWithChildren) {
    const [status, setStatus] = useState(initialStatus);
    return <AuthContext value={{ status, setStatus }}>{children}</AuthContext>;
  }

  jest.mocked(useAuth).mockImplementation(useTestAuth);

  const route = renderRouter(
    {
      _layout: AuthGateLayout,
      index: RootIndex,
      loading: LoadingScreen,
      '(auth)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
      '(auth)/login': LoginScreen,
      '(app)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
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

  it('초기 URL 조회가 실패해도 인증 화면 이동을 막지 않는다', async () => {
    // Given: 네이티브 초기 URL 조회가 실패한다
    const error = new Error('initial URL unavailable');
    jest.spyOn(Linking, 'getInitialURL').mockRejectedValue(error);

    // When: 인증된 앱을 시작한다
    const route = await renderAuthRoutes('authenticated');

    // Then: 피드에 도착하고 관측 포트에 오류를 보고한다
    expect(route.getPathname()).toBe('/feed');
    await waitFor(() => {
      expect(useErrorReporter().captureException).toHaveBeenCalledWith(error, {
        feature: 'widget_app_entry',
      });
    });
  });
});
