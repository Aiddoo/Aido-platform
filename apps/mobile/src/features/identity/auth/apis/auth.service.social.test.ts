import '@src/shared/i18n/init';
import { isCodedError } from '@src/core/errors/result';
import { getUserFacingMessage } from '@src/shared/errors';
import {
  createHttpClientStub,
  createLoggerStub,
  createMemoryTokenStore,
  createSocialAuthGatewayStub,
} from '@src/testing/core';

import { createAuthApiError, createAuthTokensDto } from '../__tests__/auth.fixtures';
import { AuthService } from './auth.service';

const APPLE_CREDENTIAL = {
  type: 'success' as const,
  identityToken: 'apple-id-token',
  nonce: 'raw-nonce',
  givenName: null,
};

function oauthSuccess(url: string) {
  return {
    type: 'success' as const,
    url,
    queryParams: Object.fromEntries(new URL(url).searchParams.entries()),
  };
}

describe('소셜 로그인', () => {
  let publicHttp: ReturnType<typeof createHttpClientStub>;
  let authHttp: ReturnType<typeof createHttpClientStub>;
  let tokenStore: ReturnType<typeof createMemoryTokenStore>;
  let gateway: ReturnType<typeof createSocialAuthGatewayStub>;
  let service: AuthService;

  beforeEach(() => {
    publicHttp = createHttpClientStub();
    authHttp = createHttpClientStub();
    tokenStore = createMemoryTokenStore();
    gateway = createSocialAuthGatewayStub();
    service = new AuthService({
      publicHttpClient: publicHttp,
      authHttpClient: authHttp,
      tokenStore,
      socialAuthGateway: gateway,
      deviceType: 'IOS',
      logger: createLoggerStub(),
    });
  });

  describe('브라우저 로그인(카카오, 네이버, 구글)', () => {
    it.each([
      ['kakao', () => service.openKakaoLogin()],
      ['naver', () => service.openNaverLogin()],
      ['google', () => service.openGoogleLogin()],
    ])('%s은 출시된 시작 경로와 돌아올 경로로 세션을 연다', async (provider, open) => {
      // Given
      gateway.openOAuthSession.mockResolvedValue(oauthSuccess(`aido://auth/${provider}?code=abc`));

      // When
      const result = await open();

      // Then
      expect(result).toEqual({ ok: true, value: 'abc' });
      expect(gateway.openOAuthSession).toHaveBeenCalledWith({
        startPath: `v1/auth/${provider}/start`,
        callbackPath: `auth/${provider}`,
        params: { mode: 'login' },
      });
    });

    it('계정 연결은 link 모드로 시작한다', async () => {
      // Given
      gateway.openOAuthSession.mockResolvedValue(oauthSuccess('aido://auth/google?code=abc'));
      authHttp.post.mockResolvedValue({ ok: true, value: { message: '연결됨' } });

      // When
      await service.linkAccount('google');

      // Then
      expect(gateway.openOAuthSession).toHaveBeenCalledWith({
        startPath: 'v1/auth/google/start',
        callbackPath: 'auth/google',
        params: { mode: 'link' },
      });
    });

    it.each([
      ['쿼리', 'aido://auth/kakao?code=from-query', 'from-query'],
      ['해시', 'aido://auth/kakao#code=from-hash', 'from-hash'],
    ])('돌아온 주소의 %s에서 코드를 읽는다', async (_name, url, code) => {
      // Given
      gateway.openOAuthSession.mockResolvedValue(oauthSuccess(url));

      // When
      const result = await service.openKakaoLogin();

      // Then
      expect(result).toEqual({ ok: true, value: code });
    });

    it.each([
      ['cancelled', 'AUTH_LOGIN_CANCELLED'],
      ['failed', 'AUTH_UNKNOWN'],
    ] as const)('세션이 %s면 %s로 끝난다', async (type, code) => {
      // Given
      gateway.openOAuthSession.mockResolvedValue({ type });

      // When
      const result = await service.openNaverLogin();

      // Then
      expect(result.ok).toBe(false);
      expect(!result.ok && isCodedError(result.error, code)).toBe(true);
    });

    it('서버 오류 코드는 카탈로그 문구로, 모르는 코드는 호출부 폴백으로 보여 준다', async () => {
      // Given
      gateway.openOAuthSession.mockResolvedValue(
        oauthSuccess('aido://auth/kakao?error=AUTH_0101&error_description=fail'),
      );

      // When
      const known = await service.openKakaoLogin();
      gateway.openOAuthSession.mockResolvedValue(
        oauthSuccess('aido://auth/kakao?error=authentication_failed'),
      );
      const unknown = await service.openKakaoLogin();

      // Then
      expect(!known.ok && getUserFacingMessage(known.error)).toBeTruthy();
      expect(!unknown.ok && getUserFacingMessage(unknown.error)).toBeUndefined();
    });

    it('코드도 오류도 없이 돌아오면 코드를 받지 못한 오류다', async () => {
      // Given
      gateway.openOAuthSession.mockResolvedValue(oauthSuccess('aido://auth/kakao'));

      // When
      const result = await service.openKakaoLogin();

      // Then
      expect(!result.ok && isCodedError(result.error, 'AUTH_NO_CODE_RECEIVED')).toBe(true);
    });

    it('서버가 오류 코드를 실어 돌려보내면 토큰을 저장하지 않고 실패한다', async () => {
      // Given
      gateway.openOAuthSession.mockResolvedValue(
        oauthSuccess('aido://auth/kakao?error=authentication_failed&error_description=fail'),
      );

      // When
      const result = await service.openKakaoLogin();

      // Then
      expect(result.ok).toBe(false);
      expect(tokenStore.save).not.toHaveBeenCalled();
    });
  });

  describe('Apple 로그인', () => {
    it('원본 nonce를 서버에 보내 토큰을 저장한다', async () => {
      // Given
      gateway.signInWithApple.mockResolvedValue(APPLE_CREDENTIAL);
      const dto = createAuthTokensDto();
      publicHttp.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.openAppleLogin();

      // Then
      expect(publicHttp.post).toHaveBeenCalledWith('v1/auth/apple/callback', {
        idToken: 'apple-id-token',
        nonce: 'raw-nonce',
        userName: undefined,
        deviceType: 'IOS',
      });
      expect(tokenStore.save).toHaveBeenCalledWith({
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
      });
      expect(result.ok).toBe(true);
    });

    it('조립에서 받은 기기 종류로 세션을 구분한다', async () => {
      // Given
      const androidService = new AuthService({
        publicHttpClient: publicHttp,
        authHttpClient: authHttp,
        tokenStore,
        socialAuthGateway: gateway,
        deviceType: 'ANDROID',
        logger: createLoggerStub(),
      });
      gateway.signInWithApple.mockResolvedValue(APPLE_CREDENTIAL);
      publicHttp.post.mockResolvedValue({ ok: true, value: createAuthTokensDto() });

      // When
      await androidService.openAppleLogin();

      // Then
      expect(publicHttp.post).toHaveBeenCalledWith(
        'v1/auth/apple/callback',
        expect.objectContaining({ deviceType: 'ANDROID' }),
      );
    });

    it('처음 가입이라 이름을 주면 함께 보낸다', async () => {
      // Given
      gateway.signInWithApple.mockResolvedValue({ ...APPLE_CREDENTIAL, givenName: '민수' });
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
      ['cancelled', 'AUTH_LOGIN_CANCELLED'],
      ['invalid-response', 'AUTH_APPLE_INVALID_RESPONSE'],
      ['unavailable', 'AUTH_APPLE_UNAVAILABLE'],
      ['failed', 'AUTH_UNKNOWN'],
      ['no-token', 'AUTH_APPLE_NO_TOKEN'],
    ] as const)('로그인 창 결과가 %s면 %s로 끝나고 서버에 보내지 않는다', async (type, code) => {
      // Given
      gateway.signInWithApple.mockResolvedValue({ type });

      // When
      const result = await service.openAppleLogin();

      // Then
      expect(!result.ok && isCodedError(result.error, code)).toBe(true);
      expect(publicHttp.post).not.toHaveBeenCalled();
    });

    it('서버가 거부하면 그 오류를 돌려주고 토큰을 저장하지 않는다', async () => {
      // Given
      gateway.signInWithApple.mockResolvedValue(APPLE_CREDENTIAL);
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
      gateway.signInWithApple.mockResolvedValue(APPLE_CREDENTIAL);
      authHttp.post.mockResolvedValue({ ok: true, value: { message: '연결됨' } });

      // When
      const result = await service.linkAccount('apple');

      // Then
      expect(result).toEqual({ ok: true, value: { message: '연결됨' } });
      expect(authHttp.post).toHaveBeenCalledWith('v1/auth/link', {
        provider: 'APPLE',
        idToken: 'apple-id-token',
        nonce: 'raw-nonce',
      });
      expect(tokenStore.save).not.toHaveBeenCalled();
    });
  });
});
