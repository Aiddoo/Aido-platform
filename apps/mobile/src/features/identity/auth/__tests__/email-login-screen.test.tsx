import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createHttpClientStub,
  createMemoryTokenStore,
  createPendingResponse,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useNavigation } from 'expo-router';
import { TextInput } from 'react-native';

import EmailLoginRoute from '../../../../../app/(auth)/email-login';
import { createAuthApiError, createAuthTokensDto } from './auth.fixtures';
import { createAuthSessionStoreStub } from './create-auth-session-store-stub';

const EMAIL = 'user@example.com';
const PASSWORD = 'fake-pass1';

async function renderEmailLogin(httpClient: ReturnType<typeof createHttpClientStub>) {
  const authSessionStore = createAuthSessionStoreStub('unauthenticated');
  const tokenStore = createMemoryTokenStore();
  await renderScreen(<EmailLoginRoute />, {
    di: createTestDi({ ports: { httpClient, tokenStore }, seeds: { authSessionStore } }),
  });
  await screen.findByTestId('email-login-submit');
  return { authSessionStore, tokenStore };
}

async function typeCredentials(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('email-login-email'), email);
  await fireEvent.changeText(screen.getByTestId('email-login-password'), password);
}

describe('EmailLoginRoute', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;

  beforeEach(() => {
    httpClient = createHttpClientStub();
  });

  it('빈 칸으로 누르면 칸마다 안내하고 요청하지 않는다', async () => {
    // Given
    await renderEmailLogin(httpClient);

    // When
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // Then
    expect(await screen.findByText('올바른 이메일 형식이 아니에요')).toBeTruthy();
    expect(screen.getByText('비밀번호를 입력해주세요')).toBeTruthy();
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('빈 칸으로 누르면 검증에 실패한 첫 칸으로 포커스를 옮긴다', async () => {
    // Given
    await renderEmailLogin(httpClient);
    const focus = jest.spyOn(TextInput.prototype, 'focus');

    // When
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // Then
    await waitFor(() => expect(focus).toHaveBeenCalled());
  });

  it('로그인하면 적은 이메일과 비밀번호를 보내고 받은 토큰으로 로그인 상태가 된다', async () => {
    // Given
    httpClient.post.mockResolvedValue(ok(createAuthTokensDto()));
    const { authSessionStore, tokenStore } = await renderEmailLogin(httpClient);
    await typeCredentials(EMAIL, PASSWORD);

    // When
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // Then
    await waitFor(() => expect(authSessionStore.getSnapshot().status).toBe('authenticated'));
    expect(httpClient.post).toHaveBeenCalledWith('v1/auth/login', {
      email: EMAIL,
      password: PASSWORD,
      deviceType: 'IOS',
    });
    await expect(tokenStore.getRefreshToken()).resolves.toBe(createAuthTokensDto().refreshToken);
  });

  it('틀린 비밀번호는 서버 안내를 토스트로 한 번 알리고 입력값을 지킨다', async () => {
    // Given
    httpClient.post.mockResolvedValue(
      fail(createAuthApiError({ status: 401, message: '이메일 또는 비밀번호가 틀렸어요' })),
    );
    const { authSessionStore } = await renderEmailLogin(httpClient);
    await typeCredentials(EMAIL, 'wrong-pass1');

    // When
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // Then
    expect(await screen.findAllByText('이메일 또는 비밀번호가 틀렸어요')).toHaveLength(1);
    expect(screen.getByTestId('email-login-email').props.value).toBe(EMAIL);
    expect(screen.getByTestId('email-login-password').props.value).toBe('wrong-pass1');
    expect(authSessionStore.getSnapshot().status).toBe('unauthenticated');
  });

  it('연결이 끊겨 실패해도 안내하고 입력값을 지킨다', async () => {
    // Given
    httpClient.post.mockRejectedValue(new NetworkError());
    await renderEmailLogin(httpClient);
    await typeCredentials(EMAIL, PASSWORD);

    // When
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).toHaveLength(1);
    expect(screen.getByTestId('email-login-email').props.value).toBe(EMAIL);
    expect(screen.getByTestId('email-login-password').props.value).toBe(PASSWORD);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('인증하지 않은 이메일은 입력한 주소로 인증 화면에 보낸다', async () => {
    // Given
    httpClient.post.mockResolvedValue(
      fail(createAuthApiError({ code: 'EMAIL_0503', status: 403, message: '인증이 필요해요' })),
    );
    await renderEmailLogin(httpClient);
    await typeCredentials(EMAIL, PASSWORD);

    // When
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // Then
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/(auth)/verify-email',
        params: { email: EMAIL },
      }),
    );
    expect(screen.queryByText('인증이 필요해요')).toBeNull();
  });

  it('로그인 버튼을 연달아 눌러도 요청은 한 번이다', async () => {
    // Given
    const pending = createPendingResponse(ok(createAuthTokensDto()));
    httpClient.post.mockReturnValue(pending.response);
    await renderEmailLogin(httpClient);
    await typeCredentials(EMAIL, PASSWORD);
    const submit = screen.getByTestId('email-login-submit');

    // When
    const firstPress = fireEvent.press(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await fireEvent.press(submit);
    pending.settle();
    await firstPress;

    // Then
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['회원가입', '/sign-up'],
    ['비밀번호 찾기', '/(auth)/forgot-password'],
  ])('%s를 누르면 그 화면으로 간다', async (label, href) => {
    // Given
    await renderEmailLogin(httpClient);

    // When
    await fireEvent.press(screen.getByText(label));

    // Then
    expect(router.push).toHaveBeenCalledWith(href);
  });

  it('로그인을 같은 프레임에 두 번 눌러도 요청은 한 번이다', async () => {
    // Given
    const pending = createPendingResponse(ok(createAuthTokensDto()));
    httpClient.post.mockReturnValue(pending.response);
    await renderEmailLogin(httpClient);
    await typeCredentials(EMAIL, PASSWORD);
    const submit = screen.getByTestId('email-login-submit');

    // When
    await act(async () => {
      await fireEvent.press(submit);
      await fireEvent.press(submit);
    });
    pending.settle();

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalled());
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('로그인을 기다리는 사이 떠났으면 인증하지 않은 이메일이어도 인증 화면을 올리지 않는다', async () => {
    // Given
    let isFocused = true;
    jest.mocked(useNavigation).mockImplementation(() => ({
      isFocused: () => isFocused,
      getParent: () => undefined,
      addListener: () => () => undefined,
    }));
    const pending = createPendingResponse(
      fail(createAuthApiError({ code: 'EMAIL_0503', status: 403, message: '인증이 필요해요' })),
    );
    httpClient.post.mockReturnValue(pending.response);
    await renderEmailLogin(httpClient);
    await typeCredentials(EMAIL, PASSWORD);
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // When
    isFocused = false;
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() => expect(screen.getByTestId('email-login-submit')).toBeEnabled());
    expect(router.push).not.toHaveBeenCalled();
  });

  describe('로그인 뒤 떠나는 동안', () => {
    setupFakeTimersPerTest();

    it('로그인해 화면이 바뀌는 동안 다시 눌러도 로그인 요청은 한 번이다', async () => {
      // Given
      httpClient.post.mockResolvedValue(ok(createAuthTokensDto()));
      const { authSessionStore } = await renderEmailLogin(httpClient);
      await typeCredentials(EMAIL, PASSWORD);
      await fireEvent.press(screen.getByTestId('email-login-submit'));
      // 연타 가드(600ms)가 지난 뒤다. 인증 화면 묶음이 빠지는 전환이 끝나야 내려가 버튼이 아직 보인다
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(authSessionStore.getSnapshot().status).toBe('authenticated');

      // When
      await fireEvent.press(screen.getByTestId('email-login-submit'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });
  });
});
