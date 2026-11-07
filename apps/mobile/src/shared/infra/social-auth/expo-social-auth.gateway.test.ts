import { ENV } from '@src/shared/config/env';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';

import { expoSocialAuthGateway } from './expo-social-auth.gateway';

jest.mock('expo-web-browser', () => ({
  WebBrowserResultType: {
    CANCEL: 'cancel',
    DISMISS: 'dismiss',
    LOCKED: 'locked',
    OPENED: 'opened',
  },
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(),
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: ({ scheme, path }: { scheme: string; path: string }) => `${scheme}://${path}`,
}));
// expo-linking의 parse는 개발 서버 주소를 읽어 테스트 환경에서 실패한다. 쿼리 해석만 같게 둔다
jest.mock('expo-linking', () => ({
  parse: (url: string) => ({
    queryParams: Object.fromEntries(new URL(url).searchParams.entries()),
  }),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomBytes: (size: number) => new Uint8Array(size).fill(171),
  digestStringAsync: async (_algorithm: string, value: string) => `hashed:${value}`,
}));

const NONCE = 'ab'.repeat(32);
const APPLE_CREDENTIAL = {
  identityToken: 'apple-id-token',
  user: 'apple-user',
  state: null,
  fullName: null,
  email: null,
  realUserStatus: 1,
  authorizationCode: null,
};

describe('expoSocialAuthGateway', () => {
  const openAuthSession = jest.mocked(WebBrowser.openAuthSessionAsync);
  const signInWithApple = jest.mocked(AppleAuthentication.signInAsync);

  describe('브라우저 세션', () => {
    const REQUEST = {
      startPath: 'v1/auth/kakao/start',
      callbackPath: 'auth/kakao',
      params: { mode: 'login' },
    };

    it('출시된 시작 주소와 돌아올 주소로 브라우저를 연다', async () => {
      // Given
      const redirectUri = `${ENV.SCHEME}://auth/kakao`;
      openAuthSession.mockResolvedValue({ type: 'success', url: `${redirectUri}?code=abc` });

      // When
      const result = await expoSocialAuthGateway.openOAuthSession(REQUEST);

      // Then
      const params = new URLSearchParams({ redirect_uri: redirectUri, mode: 'login' });
      expect(openAuthSession).toHaveBeenCalledWith(
        `${ENV.API_URL}/v1/auth/kakao/start?${params.toString()}`,
        redirectUri,
        { createTask: false },
      );
      expect(result).toEqual({
        type: 'success',
        url: `${redirectUri}?code=abc`,
        queryParams: { code: 'abc' },
      });
    });

    it.each([
      [WebBrowser.WebBrowserResultType.CANCEL, 'cancelled'],
      [WebBrowser.WebBrowserResultType.DISMISS, 'cancelled'],
      [WebBrowser.WebBrowserResultType.LOCKED, 'failed'],
    ])('브라우저 결과가 %s면 %s로 끝난다', async (type, expected) => {
      // Given
      openAuthSession.mockResolvedValue({ type });

      // When
      const result = await expoSocialAuthGateway.openOAuthSession(REQUEST);

      // Then
      expect(result).toEqual({ type: expected });
    });

    it('딥링크로 돌아온 세션을 끝낸다', () => {
      // When
      expoSocialAuthGateway.completeOAuthSession();

      // Then
      expect(WebBrowser.maybeCompleteAuthSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('Apple 로그인', () => {
    it('해시한 nonce로 SDK를 부르고 원본 nonce를 돌려준다', async () => {
      // Given
      signInWithApple.mockResolvedValue(APPLE_CREDENTIAL);

      // When
      const result = await expoSocialAuthGateway.signInWithApple();

      // Then
      expect(signInWithApple).toHaveBeenCalledWith({
        requestedScopes: [0, 1],
        nonce: `hashed:${NONCE}`,
      });
      expect(result).toEqual({
        type: 'success',
        identityToken: 'apple-id-token',
        nonce: NONCE,
        givenName: null,
      });
    });

    it('처음 가입이라 이름을 주면 함께 돌려준다', async () => {
      // Given
      signInWithApple.mockResolvedValue({
        ...APPLE_CREDENTIAL,
        fullName: {
          namePrefix: null,
          givenName: '민수',
          middleName: null,
          familyName: null,
          nameSuffix: null,
          nickname: null,
        },
      });

      // When
      const result = await expoSocialAuthGateway.signInWithApple();

      // Then
      expect(result).toEqual(expect.objectContaining({ givenName: '민수' }));
    });

    it.each([
      ['ERR_REQUEST_CANCELED', 'cancelled'],
      ['ERR_REQUEST_FAILED', 'invalid-response'],
      ['ERR_INVALID_RESPONSE', 'invalid-response'],
      ['ERR_NOT_AVAILABLE', 'unavailable'],
      ['ERR_SOMETHING_ELSE', 'failed'],
    ])('SDK가 %s로 실패하면 %s로 끝난다', async (sdkCode, expected) => {
      // Given
      signInWithApple.mockRejectedValue(Object.assign(new Error('apple'), { code: sdkCode }));

      // When
      const result = await expoSocialAuthGateway.signInWithApple();

      // Then
      expect(result).toEqual({ type: expected });
    });

    it('토큰을 받지 못하면 no-token으로 끝난다', async () => {
      // Given
      signInWithApple.mockResolvedValue({ ...APPLE_CREDENTIAL, identityToken: null });

      // When
      const result = await expoSocialAuthGateway.signInWithApple();

      // Then
      expect(result).toEqual({ type: 'no-token' });
    });
  });
});
