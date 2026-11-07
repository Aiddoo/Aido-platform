import { createAnalyticsStub } from '@src/shared/__tests__';
import { ok } from '@src/shared/errors/result';
import { useMutation } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

import { createAuthSession } from '../__tests__/auth-session.test-utils';
import { createAuthTokensDto } from '../__tests__/auth.fixtures';
import { useAuthStatus } from '../hooks/use-auth-status';
import { useOpenAppleLoginMutationOptions } from './use-open-apple-login-mutation-options';

// 네이티브 SDK 경계만 바꾼다
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(),
}));

async function loginWithApple(dto: ReturnType<typeof createAuthTokensDto>) {
  jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
    identityToken: 'apple-id-token',
    user: 'apple-user',
    state: null,
    fullName: null,
    email: null,
    realUserStatus: 1,
    authorizationCode: null,
  });
  const analytics = createAnalyticsStub();
  const session = createAuthSession({ di: { analytics } });
  session.publicHttp.post.mockResolvedValue(ok(dto));
  const { result } = await session.renderSession(
    () => ({ status: useAuthStatus(), login: useMutation(useOpenAppleLoginMutationOptions()) }),
    'unauthenticated',
  );

  await act(async () => {
    await result.current.login.mutateAsync();
  });
  return { status: result.current.status, analytics };
}

describe('useOpenAppleLoginMutationOptions', () => {
  it('기존 계정 로그인은 인증 상태로 바꾸고 auth_login만 보낸다', async () => {
    // Given·When
    const { status, analytics } = await loginWithApple(createAuthTokensDto({ isNewUser: false }));

    // Then
    expect(status).toBe('authenticated');
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_login', { method: 'apple' });
  });

  it('신규 가입은 auth_signup만 보낸다', async () => {
    // Given·When
    const { analytics } = await loginWithApple(createAuthTokensDto({ isNewUser: true }));

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_signup', { method: 'apple' });
  });
});
