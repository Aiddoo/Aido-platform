import { AuthGateLayout } from '@src/bootstrap/navigation/auth-gate-layout';
import { ok } from '@src/core/errors/result';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import * as ExpoLinking from 'expo-linking';
import { Stack } from 'expo-router';
import { fireEvent, screen } from 'expo-router/testing-library';
import { Linking, Pressable, Text } from 'react-native';

import OAuthCallbackScreen from '../../../../../app/auth/[provider]';
import RootIndex from '../../../../../app/index';
import { createAuthSessionStoreStub } from './create-auth-session-store-stub';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

let mockAuthSessionStore = createAuthSessionStoreStub('loading');

function LoadingScreen() {
  return (
    <Pressable
      testID="boot-authenticated"
      onPress={() => mockAuthSessionStore.setStatus('authenticated')}
    >
      <Text>Restore session</Text>
    </Pressable>
  );
}

async function renderOAuthCallback(status: AuthStatus) {
  mockAuthSessionStore = createAuthSessionStoreStub(status);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async () => ok(createCurrentUserDto()));
  const di = createTestDi({
    ports: { httpClient },
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
      '(auth)/login': () => <Text testID="login">Login</Text>,
      '(app)/_layout': {
        default: () => <Stack screenOptions={{ animation: 'none' }} />,
        unstable_settings: { anchor: '(tabs)' },
      },
      '(app)/(tabs)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
      '(app)/(tabs)/feed/index': () => <Text testID="feed">Feed</Text>,
    },
    { url: '/auth/kakao', di, withLocalDate: true },
  );
  return { route, socialAuth: di.socialAuth };
}

describe('OAuthCallbackScreen', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.mocked(ExpoLinking.useLinkingURL).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['loading', 'locked'] as const)(
    '%s 상태에서 열리면 로그인 화면 대신 판정을 기다린다',
    async (status) => {
      // Given·When
      const { route, socialAuth } = await renderOAuthCallback(status);

      // Then
      expect(route.getPathname()).toBe('/loading');
      expect(screen.queryByTestId('login')).toBeNull();
      expect(socialAuth.completeOAuthSession).toHaveBeenCalled();
    },
  );

  it('판정을 기다리다 세션이 복원되면 피드로 간다', async () => {
    // Given
    const { route } = await renderOAuthCallback('loading');

    // When
    await fireEvent.press(screen.getByTestId('boot-authenticated'));

    // Then
    expect(route.getPathname()).toBe('/feed');
  });

  it.each([
    ['authenticated', '/feed'],
    ['unauthenticated', '/login'],
  ] as const)('%s 상태에서 열리면 %s로 간다', async (status, pathname) => {
    // Given·When
    const { route } = await renderOAuthCallback(status);

    // Then
    expect(route.getPathname()).toBe(pathname);
  });
});
