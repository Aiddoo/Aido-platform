import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { createContext, type PropsWithChildren, use, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import RootIndex from '../../../app/index';
import { AuthGateLayout } from './auth-gate-layout';

jest.mock('@src/bootstrap/providers/auth-provider', () => ({ useAuth: jest.fn() }));
jest.mock('@src/shared/hooks/use-screen-tracking', () => ({ useScreenTracking: jest.fn() }));
jest.mock('@src/bootstrap/hooks/use-user-identity', () => ({ useUserIdentity: jest.fn() }));
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
    },
    { initialUrl, wrapper: AuthFixture },
  );
  await route;
  return { getPathname: () => route.getPathname() };
}

describe('root 인증 route 전환', () => {
  afterEach(() => {
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
});
