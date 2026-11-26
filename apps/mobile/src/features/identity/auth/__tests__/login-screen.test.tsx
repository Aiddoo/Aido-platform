import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createMemoryTokenStore,
  createSocialAuthGatewayStub,
  createTestDi,
  getTrackedEvents,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import LoginScreen from '../../../../../app/(auth)/login';
import { createAppleSignInSuccess, createAuthTokensDto } from './auth.fixtures';
import { createAuthSessionStoreStub } from './create-auth-session-store-stub';

const OAUTH_CODE = 'one-time-code';

async function renderLogin() {
  const httpClient = createHttpClientStub();
  httpClient.post.mockResolvedValue(ok(createAuthTokensDto()));
  const socialAuth = createSocialAuthGatewayStub();
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  const authSessionStore = createAuthSessionStoreStub('unauthenticated');
  const tokenStore = createMemoryTokenStore();
  await renderScreen(<LoginScreen />, {
    di: createTestDi({
      ports: { httpClient, socialAuth, analytics, haptics, tokenStore },
      seeds: { authSessionStore },
    }),
    withOverlay: true,
  });

  return { httpClient, socialAuth, analytics, haptics, authSessionStore, tokenStore };
}

describe('LoginScreen', () => {
  describe('소셜 로그인', () => {
    it.each([
      ['카카오', 'kakao'],
      ['Google', 'google'],
      ['네이버', 'naver'],
    ] as const)(
      '%s로 계속하면 그 공급자의 로그인 창을 열고 받은 코드로 로그인한다',
      async (label, provider) => {
        // Given
        const { httpClient, socialAuth, analytics, authSessionStore, tokenStore } =
          await renderLogin();
        socialAuth.openOAuthSession.mockResolvedValue({
          type: 'success',
          url: `aido://auth/${provider}?code=${OAUTH_CODE}`,
          queryParams: { code: OAUTH_CODE },
        });

        // When
        await fireEvent.press(screen.getByRole('button', { name: `${label}로 계속하기` }));

        // Then
        await waitFor(() => expect(authSessionStore.getSnapshot().status).toBe('authenticated'));
        expect(socialAuth.openOAuthSession).toHaveBeenCalledWith({
          startPath: `v1/auth/${provider}/start`,
          callbackPath: `auth/${provider}`,
          params: { mode: 'login' },
        });
        expect(httpClient.post).toHaveBeenCalledTimes(1);
        expect(httpClient.post).toHaveBeenCalledWith('v1/auth/exchange', { code: OAUTH_CODE });
        await expect(tokenStore.getRefreshToken()).resolves.toBe(
          createAuthTokensDto().refreshToken,
        );
        expect(getTrackedEvents(analytics, 'auth_login')).toEqual([{ method: provider }]);
      },
    );

    it('Apple로 계속하면 Apple 로그인으로 받은 토큰을 보내 로그인한다', async () => {
      // Given
      const { httpClient, socialAuth, analytics, authSessionStore } = await renderLogin();
      socialAuth.signInWithApple.mockResolvedValue(createAppleSignInSuccess());

      // When
      await fireEvent.press(screen.getByRole('button', { name: 'Apple로 계속하기' }));

      // Then
      await waitFor(() => expect(authSessionStore.getSnapshot().status).toBe('authenticated'));
      expect(socialAuth.openOAuthSession).not.toHaveBeenCalled();
      expect(httpClient.post).toHaveBeenCalledWith('v1/auth/apple/callback', {
        idToken: 'apple-id-token',
        nonce: 'apple-nonce',
        userName: undefined,
        deviceType: 'IOS',
      });
      expect(getTrackedEvents(analytics, 'auth_login')).toEqual([{ method: 'apple' }]);
    });

    it('로그인 창을 닫으면 요청 없이 햅틱만 울리고 로그인 화면에 남는다', async () => {
      // Given
      const { httpClient, haptics, analytics, authSessionStore } = await renderLogin();

      // When
      await fireEvent.press(screen.getByRole('button', { name: '카카오로 계속하기' }));

      // Then
      await waitFor(() => expect(haptics.notify).toHaveBeenCalledWith('error'));
      expect(httpClient.post).not.toHaveBeenCalled();
      expect(authSessionStore.getSnapshot().status).toBe('unauthenticated');
      expect(getTrackedEvents(analytics, 'auth_login')).toEqual([]);
      expect(screen.getByRole('button', { name: '카카오로 계속하기' })).toBeOnTheScreen();
    });
  });

  describe('다른 길', () => {
    it.each([
      ['이메일로 로그인', '/email-login'],
      ['회원가입', '/sign-up'],
      ['초대 코드가 있나요?', '/invite'],
    ])('%s을 누르면 %s로 간다', async (label, href) => {
      // Given
      await renderLogin();

      // When
      await fireEvent.press(screen.getByText(label));

      // Then
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith(href);
    });
  });
});
