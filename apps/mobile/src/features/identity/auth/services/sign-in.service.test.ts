import '@src/shared/i18n/init';
import {
  err,
  getUserFacingMessage,
  isCodedError,
  KeychainLockedError,
  ok,
} from '@src/shared/errors';
import {
  createHttpClientStub,
  createLoggerStub,
  createMemoryTokenStore,
  createSocialAuthGatewayStub,
} from '@src/testing/core';

import {
  createAuthApiError,
  createAuthTokensDto,
  createDeleteAccountDto,
} from '../__tests__/auth.fixtures';
import { AuthApi } from '../apis/auth.api';
import { AUTH_LOG_EVENT } from '../constants/auth-log-events';
import { SignInService } from './sign-in.service';

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

function setup({ deviceType = 'IOS' }: { deviceType?: 'IOS' | 'ANDROID' } = {}) {
  const publicHttp = createHttpClientStub();
  const authHttp = createHttpClientStub();
  const tokenStore = createMemoryTokenStore();
  const gateway = createSocialAuthGatewayStub();
  const logger = createLoggerStub();
  const service = new SignInService({
    authApi: new AuthApi({ publicHttpClient: publicHttp, authHttpClient: authHttp }),
    tokenStore,
    socialAuth: gateway,
    deviceType,
    logger,
  });
  return { publicHttp, authHttp, tokenStore, gateway, logger, service };
}

describe('SignInService', () => {
  describe('이메일 로그인', () => {
    it('기기 종류를 붙여 보내고 받은 토큰을 이 기기에 저장한다', async () => {
      // Given
      const { service, publicHttp, tokenStore } = setup({ deviceType: 'ANDROID' });
      const dto = createAuthTokensDto();
      publicHttp.post.mockResolvedValue(ok(dto));

      // When
      const result = await service.emailLogin({ email: 'a@aido.app', password: 'pw' });

      // Then
      expect(result.ok).toBe(true);
      expect(publicHttp.post).toHaveBeenCalledWith('v1/auth/login', {
        email: 'a@aido.app',
        password: 'pw',
        deviceType: 'ANDROID',
      });
      await expect(tokenStore.getRefreshToken()).resolves.toBe(dto.refreshToken);
    });

    it('서버가 거부하면 그 오류를 돌려주고 토큰을 저장하지 않는다', async () => {
      // Given
      const { service, publicHttp, tokenStore } = setup();
      const error = createAuthApiError({ code: 'USER_0602' });
      publicHttp.post.mockResolvedValue(err(error));

      // When
      const result = await service.emailLogin({ email: 'a@aido.app', password: 'wrong' });

      // Then
      expect(result).toEqual(err(error));
      await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
    });

    it('키체인이 잠겨 저장하지 못하면 로그인 실패로 던져 인증 상태를 바꾸지 않게 한다', async () => {
      // Given
      const { service, publicHttp, tokenStore } = setup();
      publicHttp.post.mockResolvedValue(ok(createAuthTokensDto()));
      tokenStore.save.mockRejectedValue(new KeychainLockedError(new Error('locked')));

      // When
      const login = service.emailLogin({ email: 'a@aido.app', password: 'pw' });

      // Then
      await expect(login).rejects.toBeInstanceOf(KeychainLockedError);
    });
  });

  it.each([
    ['코드 교환', (service: SignInService) => service.exchangeCode({ code: 'one-time' })],
    [
      '이메일 인증',
      (service: SignInService) => service.verifyEmail({ email: 'a@aido.app', code: '123456' }),
    ],
  ])('%s에 성공하면 받은 토큰을 저장한다', async (_name, signIn) => {
    // Given
    const { service, publicHttp, tokenStore } = setup();
    const dto = createAuthTokensDto();
    publicHttp.post.mockResolvedValue(ok(dto));

    // When
    await signIn(service);

    // Then
    await expect(tokenStore.getAccessToken()).resolves.toBe(dto.accessToken);
  });

  describe('브라우저 로그인(카카오, 네이버, 구글)', () => {
    it.each([
      ['kakao', (service: SignInService) => service.openKakaoLogin()],
      ['naver', (service: SignInService) => service.openNaverLogin()],
      ['google', (service: SignInService) => service.openGoogleLogin()],
    ])('%s은 출시된 시작 경로와 돌아올 경로로 세션을 연다', async (provider, open) => {
      // Given
      const { service, gateway } = setup();
      gateway.openOAuthSession.mockResolvedValue(oauthSuccess(`aido://auth/${provider}?code=abc`));

      // When
      const result = await open(service);

      // Then
      expect(result).toEqual(ok('abc'));
      expect(gateway.openOAuthSession).toHaveBeenCalledWith({
        startPath: `v1/auth/${provider}/start`,
        callbackPath: `auth/${provider}`,
        params: { mode: 'login' },
      });
    });

    it.each([
      ['쿼리', 'aido://auth/kakao?code=from-query', 'from-query'],
      ['해시', 'aido://auth/kakao#code=from-hash', 'from-hash'],
    ])('돌아온 주소의 %s에서 코드를 읽는다', async (_name, url, code) => {
      // Given
      const { service, gateway } = setup();
      gateway.openOAuthSession.mockResolvedValue(oauthSuccess(url));

      // When
      const result = await service.openKakaoLogin();

      // Then
      expect(result).toEqual(ok(code));
    });

    it.each([
      ['cancelled', 'AUTH_LOGIN_CANCELLED'],
      ['failed', 'AUTH_UNKNOWN'],
    ] as const)('창이 %s로 닫히면 %s로 끝나고 토큰을 건드리지 않는다', async (type, code) => {
      // Given
      const { service, gateway, publicHttp, tokenStore } = setup();
      gateway.openOAuthSession.mockResolvedValue({ type });

      // When
      const result = await service.openNaverLogin();

      // Then
      expect(!result.ok && isCodedError(result.error, code)).toBe(true);
      expect(publicHttp.post).not.toHaveBeenCalled();
      expect(tokenStore.save).not.toHaveBeenCalled();
    });

    it('서버 오류 코드는 카탈로그 문구로, 모르는 코드는 호출부 폴백으로 보여 준다', async () => {
      // Given
      const { service, gateway } = setup();
      gateway.openOAuthSession.mockResolvedValueOnce(
        oauthSuccess('aido://auth/kakao?error=AUTH_0101&error_description=fail'),
      );
      gateway.openOAuthSession.mockResolvedValueOnce(
        oauthSuccess('aido://auth/kakao?error=authentication_failed'),
      );

      // When
      const known = await service.openKakaoLogin();
      const unknown = await service.openKakaoLogin();

      // Then
      expect(!known.ok && getUserFacingMessage(known.error)).toBeTruthy();
      expect(!unknown.ok && getUserFacingMessage(unknown.error)).toBeUndefined();
    });

    it('코드도 오류도 없이 돌아오면 코드를 받지 못한 오류다', async () => {
      // Given
      const { service, gateway } = setup();
      gateway.openOAuthSession.mockResolvedValue(oauthSuccess('aido://auth/kakao'));

      // When
      const result = await service.openKakaoLogin();

      // Then
      expect(!result.ok && isCodedError(result.error, 'AUTH_NO_CODE_RECEIVED')).toBe(true);
    });
  });

  describe('Apple 로그인', () => {
    it('원본 nonce와 기기 종류를 보내고 토큰을 저장한다', async () => {
      // Given
      const { service, gateway, publicHttp, tokenStore } = setup();
      gateway.signInWithApple.mockResolvedValue(APPLE_CREDENTIAL);
      const dto = createAuthTokensDto();
      publicHttp.post.mockResolvedValue(ok(dto));

      // When
      const result = await service.openAppleLogin();

      // Then
      expect(result.ok).toBe(true);
      expect(publicHttp.post).toHaveBeenCalledWith('v1/auth/apple/callback', {
        idToken: 'apple-id-token',
        nonce: 'raw-nonce',
        userName: undefined,
        deviceType: 'IOS',
      });
      await expect(tokenStore.getRefreshToken()).resolves.toBe(dto.refreshToken);
    });

    it('처음 가입이라 이름을 주면 함께 보낸다', async () => {
      // Given
      const { service, gateway, publicHttp } = setup();
      gateway.signInWithApple.mockResolvedValue({ ...APPLE_CREDENTIAL, givenName: '민수' });
      publicHttp.post.mockResolvedValue(ok(createAuthTokensDto()));

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
      const { service, gateway, publicHttp } = setup();
      gateway.signInWithApple.mockResolvedValue({ type });

      // When
      const result = await service.openAppleLogin();

      // Then
      expect(!result.ok && isCodedError(result.error, code)).toBe(true);
      expect(publicHttp.post).not.toHaveBeenCalled();
    });
  });

  describe('계정 연결', () => {
    it('브라우저 공급자는 link 모드로 연 뒤 받은 코드를 인증된 요청으로 보낸다', async () => {
      // Given
      const { service, gateway, authHttp, tokenStore } = setup();
      gateway.openOAuthSession.mockResolvedValue(oauthSuccess('aido://auth/google?code=abc'));
      authHttp.post.mockResolvedValue(ok({ message: '연결됨' }));

      // When
      const result = await service.linkAccount('google');

      // Then
      expect(result).toEqual(ok({ message: '연결됨' }));
      expect(gateway.openOAuthSession).toHaveBeenCalledWith(
        expect.objectContaining({ params: { mode: 'link' } }),
      );
      expect(authHttp.post).toHaveBeenCalledWith('v1/auth/link-with-code', { code: 'abc' });
      expect(tokenStore.save).not.toHaveBeenCalled();
    });

    it('Apple은 id 토큰을 인증된 요청으로 보내고 토큰을 저장하지 않는다', async () => {
      // Given
      const { service, gateway, authHttp, tokenStore } = setup();
      gateway.signInWithApple.mockResolvedValue(APPLE_CREDENTIAL);
      authHttp.post.mockResolvedValue(ok({ message: '연결됨' }));

      // When
      await service.linkAccount('apple');

      // Then
      expect(authHttp.post).toHaveBeenCalledWith('v1/auth/link', {
        provider: 'APPLE',
        idToken: 'apple-id-token',
        nonce: 'raw-nonce',
      });
      expect(tokenStore.save).not.toHaveBeenCalled();
    });
  });

  describe('탈퇴', () => {
    it('서버가 탈퇴를 확정하면 이 기기의 토큰을 지운다', async () => {
      // Given
      const { service, authHttp, tokenStore } = setup();
      await tokenStore.save({ accessToken: 'access-a', refreshToken: 'refresh-a' });
      authHttp.delete.mockResolvedValue(ok(createDeleteAccountDto()));

      // When
      const result = await service.deleteAccount({ password: 'pw' });

      // Then
      expect(result.ok).toBe(true);
      await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
    });

    it('비밀번호가 틀려 거부되면 토큰을 남긴다', async () => {
      // Given
      const { service, authHttp, tokenStore } = setup();
      await tokenStore.save({ accessToken: 'access-a', refreshToken: 'refresh-a' });
      authHttp.delete.mockResolvedValue(err(createAuthApiError({ code: 'USER_0602' })));

      // When
      await service.deleteAccount({ password: 'wrong' });

      // Then
      await expect(tokenStore.getRefreshToken()).resolves.toBe('refresh-a');
    });

    it('토큰을 지우지 못해도 서버 탈퇴는 성공으로 돌려주고 경고를 남긴다', async () => {
      // Given
      const { service, authHttp, tokenStore, logger } = setup();
      authHttp.delete.mockResolvedValue(ok(createDeleteAccountDto()));
      tokenStore.clear.mockRejectedValue(new Error('keychain delete failed'));

      // When
      const result = await service.deleteAccount({ password: 'pw' });

      // Then
      expect(result.ok).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(AUTH_LOG_EVENT.LOCAL_SESSION_CLEAR_FAILED, {
        error: 'keychain delete failed',
      });
    });
  });
});
