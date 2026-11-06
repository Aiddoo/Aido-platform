import { createHttpClientStub, createMockTokenStore } from '@src/shared/__tests__';
import { ENV } from '@src/shared/config/env';
import { isBusinessError } from '@src/shared/errors/result';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';

import { createAuthApiError, createAuthTokensDto } from '../__tests__/auth.fixtures';
import { AuthService } from './auth.service';

// 네이티브 SDK 경계만 바꾼다. 로그인 시작 주소와 결과 해석은 실제 코드를 지난다.
jest.mock('expo-web-browser', () => ({
  WebBrowserResultType: {
    CANCEL: 'cancel',
    DISMISS: 'dismiss',
    LOCKED: 'locked',
    OPENED: 'opened',
  },
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

describe('소셜 로그인', () => {
  let publicHttp: ReturnType<typeof createHttpClientStub>;
  let authHttp: ReturnType<typeof createHttpClientStub>;
  let tokenStore: ReturnType<typeof createMockTokenStore>;
  let service: AuthService;

  const openAuthSession = jest.mocked(WebBrowser.openAuthSessionAsync);
  const signInWithApple = jest.mocked(AppleAuthentication.signInAsync);

  beforeEach(() => {
    jest.clearAllMocks();
    publicHttp = createHttpClientStub();
    authHttp = createHttpClientStub();
    tokenStore = createMockTokenStore();
    service = new AuthService(publicHttp, authHttp, tokenStore);
  });

  describe('브라우저 로그인(카카오, 네이버, 구글)', () => {
    it.each([
      ['kakao', () => service.openKakaoLogin()],
      ['naver', () => service.openNaverLogin()],
      ['google', () => service.openGoogleLogin()],
    ])('%s은 출시된 시작 주소와 돌아올 주소로 브라우저를 연다', async (provider, open) => {
      // Given
      const redirectUri = `${ENV.SCHEME}://auth/${provider}`;
      openAuthSession.mockResolvedValue({ type: 'success', url: `${redirectUri}?code=abc` });

      // When
      const result = await open();

      // Then
      expect(result).toEqual({ ok: true, value: 'abc' });
      const params = new URLSearchParams({ redirect_uri: redirectUri, mode: 'login' });
      expect(openAuthSession).toHaveBeenCalledWith(
        `${ENV.API_URL}/v1/auth/${provider}/start?${params.toString()}`,
        redirectUri,
        { createTask: false },
      );
    });

    it('계정 연결은 link 모드와 사용자 힌트를 함께 보낸다', async () => {
      // Given
      const redirectUri = `${ENV.SCHEME}://auth/google`;
      openAuthSession.mockResolvedValue({ type: 'success', url: `${redirectUri}?code=abc` });

      // When
      await service.openLinkOAuth('google', 'user-1');

      // Then
      const params = new URLSearchParams({
        redirect_uri: redirectUri,
        mode: 'link',
        user_hint: 'user-1',
      });
      expect(openAuthSession).toHaveBeenCalledWith(
        `${ENV.API_URL}/v1/auth/google/start?${params.toString()}`,
        redirectUri,
        { createTask: false },
      );
    });

    it.each([
      ['쿼리', 'aido://auth/kakao?code=from-query', 'from-query'],
      ['해시', 'aido://auth/kakao#code=from-hash', 'from-hash'],
    ])('돌아온 주소의 %s에서 코드를 읽는다', async (_name, url, code) => {
      // Given
      openAuthSession.mockResolvedValue({ type: 'success', url });

      // When
      const result = await service.openKakaoLogin();

      // Then
      expect(result).toEqual({ ok: true, value: code });
    });

    it.each([
      [WebBrowser.WebBrowserResultType.CANCEL, 'AUTH_LOGIN_CANCELLED'],
      [WebBrowser.WebBrowserResultType.DISMISS, 'AUTH_LOGIN_CANCELLED'],
      [WebBrowser.WebBrowserResultType.LOCKED, 'AUTH_UNKNOWN'],
    ])('브라우저 결과가 %s면 %s로 끝난다', async (type, code) => {
      // Given
      openAuthSession.mockResolvedValue({ type });

      // When
      const result = await service.openNaverLogin();

      // Then
      expect(result.ok).toBe(false);
      expect(!result.ok && isBusinessError(result.error, code)).toBe(true);
    });

    it('코드도 오류도 없이 돌아오면 코드를 받지 못한 오류다', async () => {
      // Given
      openAuthSession.mockResolvedValue({ type: 'success', url: 'aido://auth/kakao' });

      // When
      const result = await service.openKakaoLogin();

      // Then
      expect(!result.ok && isBusinessError(result.error, 'AUTH_NO_CODE_RECEIVED')).toBe(true);
    });

    it('서버가 오류 코드를 실어 돌려보내면 토큰을 저장하지 않고 실패한다', async () => {
      // Given
      openAuthSession.mockResolvedValue({
        type: 'success',
        url: 'aido://auth/kakao?error=authentication_failed&error_description=fail',
      });

      // When
      const result = await service.openKakaoLogin();

      // Then
      expect(result.ok).toBe(false);
      expect(tokenStore.save).not.toHaveBeenCalled();
    });
  });

  describe('Apple 로그인', () => {
    it('해시한 nonce로 SDK를 부르고 원본 nonce를 서버에 보내 토큰을 저장한다', async () => {
      // Given
      signInWithApple.mockResolvedValue(APPLE_CREDENTIAL);
      const dto = createAuthTokensDto();
      publicHttp.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.openAppleLogin();

      // Then
      expect(signInWithApple).toHaveBeenCalledWith({
        requestedScopes: [0, 1],
        nonce: `hashed:${NONCE}`,
      });
      expect(publicHttp.post).toHaveBeenCalledWith('v1/auth/apple/callback', {
        idToken: 'apple-id-token',
        nonce: NONCE,
        userName: undefined,
        deviceType: 'IOS',
      });
      expect(tokenStore.save).toHaveBeenCalledWith({
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
      });
      expect(result.ok).toBe(true);
    });

    it('처음 가입이라 이름을 주면 함께 보낸다', async () => {
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
      publicHttp.post.mockResolvedValue({ ok: true, value: createAuthTokensDto() });

      // When
      await service.openAppleLogin();

      // Then
      expect(publicHttp.post).toHaveBeenCalledWith(
        'v1/auth/apple/callback',
        expect.objectContaining({ userName: '민수' }),
      );
    });

    it.each([
      ['ERR_REQUEST_CANCELED', 'AUTH_LOGIN_CANCELLED'],
      ['ERR_SOMETHING_ELSE', 'AUTH_UNKNOWN'],
    ])('SDK가 %s로 실패하면 %s로 끝난다', async (sdkCode, code) => {
      // Given
      signInWithApple.mockRejectedValue(Object.assign(new Error('apple'), { code: sdkCode }));

      // When
      const result = await service.openAppleLogin();

      // Then
      expect(!result.ok && isBusinessError(result.error, code)).toBe(true);
      expect(publicHttp.post).not.toHaveBeenCalled();
    });

    it('서버가 거부하면 그 오류를 돌려주고 토큰을 저장하지 않는다', async () => {
      // Given
      signInWithApple.mockResolvedValue(APPLE_CREDENTIAL);
      const error = createAuthApiError({ code: 'AUTH_0101' });
      publicHttp.post.mockResolvedValue({ ok: false, error });

      // When
      const result = await service.openAppleLogin();

      // Then
      expect(result).toEqual({ ok: false, error });
      expect(tokenStore.save).not.toHaveBeenCalled();
    });

    it('계정 연결은 토큰을 저장하지 않고 인증된 요청으로 보낸다', async () => {
      // Given
      signInWithApple.mockResolvedValue(APPLE_CREDENTIAL);
      authHttp.post.mockResolvedValue({ ok: true, value: { message: '연결됨' } });

      // When
      const result = await service.linkApple();

      // Then
      expect(result).toEqual({ ok: true, value: { message: '연결됨' } });
      expect(authHttp.post).toHaveBeenCalledWith('v1/auth/link', {
        provider: 'APPLE',
        idToken: 'apple-id-token',
        nonce: NONCE,
      });
      expect(tokenStore.save).not.toHaveBeenCalled();
    });
  });
});
