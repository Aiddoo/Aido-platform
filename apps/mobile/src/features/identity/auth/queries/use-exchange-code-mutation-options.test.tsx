import { createAnalyticsStub } from '@src/shared/__tests__';
import { ok } from '@src/shared/errors/result';
import { useMutation } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';

import { createAuthSession } from '../__tests__/auth-session.test-utils';
import { createAuthTokensDto } from '../__tests__/auth.fixtures';
import { useAuthStatus } from '../hooks/use-auth-status';
import { useExchangeCodeMutationOptions } from './use-exchange-code-mutation-options';

async function exchangeCode(
  provider: 'google' | 'kakao',
  dto: ReturnType<typeof createAuthTokensDto>,
) {
  const analytics = createAnalyticsStub();
  const session = createAuthSession({ di: { analytics } });
  session.publicHttp.post.mockResolvedValue(ok(dto));
  const { result } = await session.renderSession(
    () => ({ status: useAuthStatus(), exchange: useMutation(useExchangeCodeMutationOptions()) }),
    'unauthenticated',
  );

  await act(async () => {
    await result.current.exchange.mutateAsync({ code: 'exchange-code', provider });
  });
  return { status: result.current.status, analytics };
}

describe('useExchangeCodeMutationOptions', () => {
  it('OAuth 성공은 인증 상태로 바꾼다', async () => {
    // Given·When
    const { status } = await exchangeCode('google', createAuthTokensDto());

    // Then
    expect(status).toBe('authenticated');
  });

  it('기존 계정 로그인은 auth_login만 보낸다', async () => {
    // Given·When
    const { analytics } = await exchangeCode('google', createAuthTokensDto({ isNewUser: false }));

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_login', { method: 'google' });
  });

  it('신규 가입은 auth_signup만 보낸다', async () => {
    // Given·When
    const { analytics } = await exchangeCode('kakao', createAuthTokensDto({ isNewUser: true }));

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_signup', { method: 'kakao' });
  });
});
