import '@src/shared/i18n/init';
import { err, ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import { createAnalyticsStub, createHapticsGatewayStub } from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { onlineManager, useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';

import { ACCOUNT_A_TOKENS, createAuthSession } from '../__tests__/auth-session.test-utils';
import {
  createAppleSignInSuccess,
  createAuthApiError,
  createAuthTokensDto,
  createRegisterDto,
} from '../__tests__/auth.fixtures';
import { useAuthStatus } from '../hooks/use-auth-status';
import {
  useEmailLoginMutationOptions,
  useExchangeCodeMutationOptions,
  useLinkAccountMutationOptions,
  useOpenAppleLoginMutationOptions,
  useOpenKakaoLoginMutationOptions,
  useRegisterMutationOptions,
  useVerifyEmailMutationOptions,
} from './auth.mutations';

// 마운트된 조회의 캐시를 비우면 떨어져 나간 쿼리에 24시간 gc 타이머가 남아 Jest 종료를 붙잡는다
setupFakeTimersPerTest();

describe('이메일 로그인 오프라인', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('스피너로 멈추지 않고 실패를 알리며 미인증으로 남는다', async () => {
    // Given
    const session = createAuthSession();
    const error = new NetworkError();
    session.publicHttp.post.mockRejectedValue(error);
    const { result } = await session.renderSession(
      () => ({ status: useAuthStatus(), login: useMutation(useEmailLoginMutationOptions()) }),
      'unauthenticated',
    );
    onlineManager.setOnline(false);

    // When
    await act(async () => {
      await result.current.login
        .mutateAsync({ email: 'a@aido.app', password: 'password-1' })
        .catch(() => undefined);
    });

    // Then
    expect(result.current.login.isPending).toBe(false);
    expect(result.current.status).toBe('unauthenticated');
    expect(await screen.findAllByText(error.message)).not.toHaveLength(0);
  });
});

describe('로그인 실패 추적', () => {
  it('이메일·비밀번호가 틀리면 방법과 이유를 남긴다', async () => {
    // Given
    const analytics = createAnalyticsStub();
    const session = createAuthSession({ ports: { analytics } });
    session.publicHttp.post.mockResolvedValue(err(createAuthApiError({ code: 'USER_0602' })));
    const { result } = await session.renderSession(
      () => useMutation(useEmailLoginMutationOptions()),
      'unauthenticated',
    );

    // When
    await act(async () => {
      await result.current
        .mutateAsync({ email: 'a@aido.app', password: 'wrong-pass1' })
        .catch(() => undefined);
    });

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_login_failed', {
      method: 'email',
      reason: 'invalid_credentials',
    });
  });

  it('소셜 인증 창을 닫으면 실패로 세지 않는다', async () => {
    // Given
    const analytics = createAnalyticsStub();
    const session = createAuthSession({ ports: { analytics } });
    session.socialAuthGateway.openOAuthSession.mockResolvedValue({ type: 'cancelled' });
    const { result } = await session.renderSession(
      () => useMutation(useOpenKakaoLoginMutationOptions()),
      'unauthenticated',
    );

    // When
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    // Then
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('auth_login_failed', expect.anything());
  });
});

describe('이메일 인증', () => {
  it('인증하면 로그인하고 어디서 인증했는지 남긴다', async () => {
    // Given
    const analytics = createAnalyticsStub();
    const session = createAuthSession({ ports: { analytics } });
    session.publicHttp.post.mockResolvedValue(ok(createAuthTokensDto()));
    const { result } = await session.renderSession(
      () => ({ status: useAuthStatus(), verify: useMutation(useVerifyEmailMutationOptions()) }),
      'unauthenticated',
    );

    // When
    await act(async () => {
      await result.current.verify.mutateAsync({
        email: 'a@aido.app',
        code: '123456',
        source: 'sign_up',
      });
    });

    // Then
    expect(result.current.status).toBe('authenticated');
    expect(session.publicHttp.post).toHaveBeenCalledWith('v1/auth/verify-email', {
      email: 'a@aido.app',
      code: '123456',
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_email_verified', {
      source: 'sign_up',
    });
  });
});

describe('구글·카카오·네이버 코드 교환', () => {
  async function exchangeCode(
    provider: 'google' | 'kakao',
    dto: ReturnType<typeof createAuthTokensDto>,
  ) {
    const analytics = createAnalyticsStub();
    const session = createAuthSession({ ports: { analytics } });
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

  it('기존 계정 로그인은 auth_login만 보낸다', async () => {
    // When
    const { analytics } = await exchangeCode('google', createAuthTokensDto({ isNewUser: false }));

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_login', { method: 'google' });
  });

  it('신규 가입은 auth_signup만 보낸다', async () => {
    // When
    const { analytics } = await exchangeCode('kakao', createAuthTokensDto({ isNewUser: true }));

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_signup', { method: 'kakao' });
  });
});

describe('Apple 로그인', () => {
  async function loginWithApple(dto: ReturnType<typeof createAuthTokensDto>) {
    const analytics = createAnalyticsStub();
    const session = createAuthSession({ ports: { analytics } });
    session.socialAuthGateway.signInWithApple.mockResolvedValue(createAppleSignInSuccess());
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

  it('기존 계정 로그인은 인증 상태로 바꾸고 auth_login만 보낸다', async () => {
    // When
    const { status, analytics } = await loginWithApple(createAuthTokensDto({ isNewUser: false }));

    // Then
    expect(status).toBe('authenticated');
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_login', { method: 'apple' });
  });

  it('신규 가입은 auth_signup만 보낸다', async () => {
    // When
    const { analytics } = await loginWithApple(createAuthTokensDto({ isNewUser: true }));

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_signup', { method: 'apple' });
  });

  it('창을 닫으면 인증 상태로 바뀌지 않고 서버에 보내지 않는다', async () => {
    // Given
    const session = createAuthSession();
    session.socialAuthGateway.signInWithApple.mockResolvedValue({ type: 'cancelled' });
    const { result } = await session.renderSession(
      () => ({ status: useAuthStatus(), login: useMutation(useOpenAppleLoginMutationOptions()) }),
      'unauthenticated',
    );

    // When
    await act(async () => {
      await result.current.login.mutateAsync().catch(() => undefined);
    });

    // Then
    expect(result.current.status).toBe('unauthenticated');
    expect(session.publicHttp.post).not.toHaveBeenCalled();
  });
});

describe('회원가입 인증 메일', () => {
  async function register(dto: ReturnType<typeof createRegisterDto>) {
    const session = createAuthSession();
    session.publicHttp.post.mockResolvedValue(ok(dto));
    const { result } = await session.renderSession(
      () => useMutation(useRegisterMutationOptions()),
      'unauthenticated',
    );

    await act(async () => {
      await result.current.mutateAsync({
        email: 'test@example.com',
        password: 'pass1234!',
        passwordConfirm: 'pass1234!',
        name: '테스트',
        termsAgreed: true,
        privacyAgreed: true,
        marketingAgreed: false,
      });
    });
  }

  const NOT_SENT_MESSAGE =
    '가입은 됐지만 인증 메일을 보내지 못했어요. 잠시 후 다시 보내기를 눌러주세요';

  it('메일을 보내지 못했으면 가입은 성공이고 재발송을 안내한다', async () => {
    // When
    await register(createRegisterDto({ emailSent: false }));

    // Then
    expect(await screen.findAllByText(NOT_SENT_MESSAGE)).not.toHaveLength(0);
  });

  it('메일을 보냈으면 따로 알리지 않는다', async () => {
    // When
    await register(createRegisterDto({ emailSent: true }));

    // Then
    expect(screen.queryByText(NOT_SENT_MESSAGE)).toBeNull();
  });
});

describe('계정 연결 실패 안내', () => {
  const LINK_FAILED_MESSAGE = i18n.t('auth:toasts.linkFailed');

  async function link(session: ReturnType<typeof createAuthSession>) {
    const { result } = await session.renderSession(
      () => useMutation(useLinkAccountMutationOptions()),
      'authenticated',
    );

    await act(async () => {
      await result.current.mutateAsync('kakao').catch(() => undefined);
    });
  }

  it('창을 닫으면 아무 안내도 하지 않는다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.socialAuthGateway.openOAuthSession.mockResolvedValue({ type: 'cancelled' });

    // When
    await link(session);

    // Then
    expect(screen.queryByText('로그인이 취소되었어요')).toBeNull();
    expect(screen.queryByText(LINK_FAILED_MESSAGE)).toBeNull();
  });

  it('모르는 오류 코드면 연결하지 않고 연결 실패 안내를 보인다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.socialAuthGateway.openOAuthSession.mockResolvedValue({
      type: 'success',
      url: 'aido://auth/kakao?error=authentication_failed',
      queryParams: { error: 'authentication_failed' },
    });

    // When
    await link(session);

    // Then
    expect(session.authHttp.post).not.toHaveBeenCalled();
    expect(await screen.findAllByText(LINK_FAILED_MESSAGE)).not.toHaveLength(0);
  });
});

describe('소셜 로그인 실패 안내', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  async function loginWithApple(session: ReturnType<typeof createAuthSession>) {
    const { result } = await session.renderSession(
      () => useMutation(useOpenAppleLoginMutationOptions()),
      'unauthenticated',
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    return result;
  }

  it('Apple 로그인이 실패하면 이유를 토스트로 알린다', async () => {
    // Given
    const session = createAuthSession();
    session.socialAuthGateway.signInWithApple.mockResolvedValue({ type: 'failed' });

    // When
    await loginWithApple(session);

    // Then
    expect(await screen.findAllByText(i18n.t('errors:AUTH_UNKNOWN'))).not.toHaveLength(0);
  });

  it('Apple 로그인 창을 닫으면 토스트 없이 햅틱만 울린다', async () => {
    // Given
    const haptics = createHapticsGatewayStub();
    const session = createAuthSession({ ports: { haptics } });
    session.socialAuthGateway.signInWithApple.mockResolvedValue({ type: 'cancelled' });

    // When
    await loginWithApple(session);

    // Then
    expect(screen.queryByText(i18n.t('errors:AUTH_LOGIN_CANCELLED'))).toBeNull();
    expect(haptics.notify).toHaveBeenCalledWith('error');
  });

  it('카카오 인증 창에서 오류가 돌아오면 이유를 토스트로 알린다', async () => {
    // Given
    const session = createAuthSession();
    session.socialAuthGateway.openOAuthSession.mockResolvedValue({
      type: 'success',
      url: 'aido://auth/kakao?error=AUTH_PROVIDER_ERROR',
      queryParams: { error: 'AUTH_PROVIDER_ERROR' },
    });
    const { result } = await session.renderSession(
      () => useMutation(useOpenKakaoLoginMutationOptions()),
      'unauthenticated',
    );

    // When
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    // Then
    expect(await screen.findAllByText(i18n.t('errors:AUTH_PROVIDER_ERROR'))).not.toHaveLength(0);
  });

  it('오프라인에서도 Apple 로그인이 멈추지 않고 실패를 알린다', async () => {
    // Given
    const session = createAuthSession();
    session.socialAuthGateway.signInWithApple.mockResolvedValue({ type: 'unavailable' });
    const { result } = await session.renderSession(
      () => useMutation(useOpenAppleLoginMutationOptions()),
      'unauthenticated',
    );
    onlineManager.setOnline(false);

    // When
    await act(async () => {
      result.current.mutate();
    });

    // Then
    expect(result.current.isPaused).toBe(false);
    expect(await screen.findAllByText(i18n.t('errors:AUTH_APPLE_UNAVAILABLE'))).not.toHaveLength(0);
  });
});
