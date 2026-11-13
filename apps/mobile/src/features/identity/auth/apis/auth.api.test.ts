import { ok } from '@src/shared/errors';
import { createHttpClientStub } from '@src/testing/core';

import {
  createAuthTokensDto,
  createDeleteAccountDto,
  createLinkedAccountsDto,
  createRegisterDto,
} from '../__tests__/auth.fixtures';
import { AuthApi } from './auth.api';

function setup() {
  const publicHttpClient = createHttpClientStub();
  const authHttpClient = createHttpClientStub();
  return {
    publicHttpClient,
    authHttpClient,
    api: new AuthApi({ publicHttpClient, authHttpClient }),
  };
}

describe('AuthApi', () => {
  it.each([
    [
      'login',
      (api: AuthApi) => api.login({ email: 'a@aido.app', password: 'pw' }),
      'v1/auth/login',
    ],
    [
      'signInWithApple',
      (api: AuthApi) => api.signInWithApple({ idToken: 'id', nonce: 'n' }),
      'v1/auth/apple/callback',
    ],
    ['exchangeCode', (api: AuthApi) => api.exchangeCode({ code: 'c' }), 'v1/auth/exchange'],
    [
      'verifyEmail',
      (api: AuthApi) => api.verifyEmail({ email: 'a@aido.app', code: '123456' }),
      'v1/auth/verify-email',
    ],
  ])(
    '%s는 로그인 전 공개 클라이언트로 보내고 토큰 응답을 모델로 바꾼다',
    async (_name, call, path) => {
      // Given
      const { api, publicHttpClient, authHttpClient } = setup();
      publicHttpClient.post.mockResolvedValue(ok(createAuthTokensDto({ name: null })));

      // When
      const result = await call(api);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith(path, expect.any(Object));
      expect(authHttpClient.post).not.toHaveBeenCalled();
      expect(result).toEqual(ok(expect.objectContaining({ userName: null, isNewUser: false })));
    },
  );

  it('가입 응답의 메일 발송 여부를 모델 이름으로 옮긴다', async () => {
    // Given
    const { api, publicHttpClient } = setup();
    publicHttpClient.post.mockResolvedValue(ok(createRegisterDto({ emailSent: false })));

    // When
    const result = await api.register({
      email: 'a@aido.app',
      password: 'Password123',
      passwordConfirm: 'Password123',
      termsAgreed: true,
      privacyAgreed: true,
    });

    // Then
    expect(result).toEqual(ok(expect.objectContaining({ isEmailSent: false })));
  });

  it('탈퇴는 인증 클라이언트의 DELETE 본문으로 비밀번호를 보낸다', async () => {
    // Given
    const { api, authHttpClient } = setup();
    authHttpClient.delete.mockResolvedValue(ok(createDeleteAccountDto()));

    // When
    await api.deleteAccount({ password: 'pw' });

    // Then
    expect(authHttpClient.delete).toHaveBeenCalledWith('v1/auth/account', {
      body: { password: 'pw' },
    });
  });

  it('연결 계정 조회는 화면을 떠나면 멈추도록 signal을 넘긴다', async () => {
    // Given
    const { api, authHttpClient } = setup();
    authHttpClient.get.mockResolvedValue(ok(createLinkedAccountsDto()));
    const { signal } = new AbortController();

    // When
    await api.getLinkedAccounts(signal);

    // Then
    expect(authHttpClient.get).toHaveBeenCalledWith('v1/auth/linked-accounts', { signal });
  });

  it('로그아웃은 인증 클라이언트로 서버 세션만 끝낸다', async () => {
    // Given
    const { api, authHttpClient } = setup();
    authHttpClient.post.mockResolvedValue(ok({ message: '로그아웃되었습니다.' }));

    // When
    const result = await api.logout({ timeout: 3_000 });

    // Then
    expect(result).toEqual(ok(undefined));
    expect(authHttpClient.post).toHaveBeenCalledWith('v1/auth/logout', undefined, {
      timeout: 3_000,
    });
  });

  it('지난 세션 해제는 그 토큰을 실어 공개 클라이언트로 보낸다', async () => {
    // Given
    const { api, publicHttpClient, authHttpClient } = setup();
    publicHttpClient.post.mockResolvedValue(ok({ message: '로그아웃되었습니다.' }));

    // When
    await api.revokeSession('access-old', { timeout: 5_000 });

    // Then
    expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/logout', undefined, {
      timeout: 5_000,
      headers: { Authorization: 'Bearer access-old' },
    });
    expect(authHttpClient.post).not.toHaveBeenCalled();
  });
});
