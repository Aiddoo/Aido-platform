import '@src/shared/i18n/init';
import { err, ok } from '@src/core/errors/result';
import { H3, Spacing } from '@src/shared/ui';
import { createPendingResponse } from '@src/testing/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { TextInput } from 'react-native';

import { createAuthSession } from '../__tests__/auth-session.test-utils';
import { createAuthApiError, createAuthTokensDto } from '../__tests__/auth.fixtures';
import { EmailLoginForm } from './email-login-form';

async function renderEmailLoginForm() {
  const session = createAuthSession();
  await render(
    <EmailLoginForm footer={null}>
      <H3>로그인</H3>
      <Spacing size={60} />
    </EmailLoginForm>,
    { wrapper: session.Wrapper },
  );
  await screen.findByTestId('email-login-submit');

  return session;
}

async function typeCredentials(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('email-login-email'), email);
  await fireEvent.changeText(screen.getByTestId('email-login-password'), password);
}

describe('이메일 로그인 폼', () => {
  it('빈 칸으로 누르면 칸마다 안내하고 요청하지 않는다', async () => {
    // Given
    const session = await renderEmailLoginForm();

    // When
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // Then
    expect(await screen.findByText('올바른 이메일 형식이 아니에요')).toBeTruthy();
    expect(screen.getByText('비밀번호를 입력해주세요')).toBeTruthy();
    expect(session.publicHttp.post).not.toHaveBeenCalled();
  });

  it('빈 칸으로 누르면 검증에 실패한 첫 칸으로 포커스를 옮긴다', async () => {
    // Given
    await renderEmailLoginForm();
    const focus = jest.spyOn(TextInput.prototype, 'focus');

    // When
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // Then
    await waitFor(() => expect(focus).toHaveBeenCalled());
    focus.mockRestore();
  });

  it('틀린 비밀번호는 서버 안내를 토스트로 알리고 입력값을 지킨다', async () => {
    // Given
    const session = await renderEmailLoginForm();
    session.publicHttp.post.mockResolvedValue(
      err(createAuthApiError({ status: 401, message: '이메일 또는 비밀번호가 틀렸어요' })),
    );
    await typeCredentials('user@aido.app', 'wrong-pass1');

    // When
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // Then
    expect(await screen.findAllByText('이메일 또는 비밀번호가 틀렸어요')).not.toHaveLength(0);
    expect(screen.getByTestId('email-login-email').props.value).toBe('user@aido.app');
    expect(screen.getByTestId('email-login-password').props.value).toBe('wrong-pass1');
  });

  it('인증하지 않은 이메일은 입력한 주소로 인증 화면에 보낸다', async () => {
    // Given
    const session = await renderEmailLoginForm();
    session.publicHttp.post.mockResolvedValue(
      err(createAuthApiError({ code: 'EMAIL_0503', status: 403, message: '인증이 필요해요' })),
    );
    await typeCredentials('user@aido.app', 'password-1');

    // When
    await fireEvent.press(screen.getByTestId('email-login-submit'));

    // Then
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/(auth)/verify-email',
        params: { email: 'user@aido.app' },
      }),
    );
  });

  it('로그인 버튼을 연달아 눌러도 요청은 한 번이다', async () => {
    // Given
    const session = await renderEmailLoginForm();
    const pending = createPendingResponse(ok(createAuthTokensDto()));
    session.publicHttp.post.mockReturnValue(pending.response);
    await typeCredentials('user@aido.app', 'password-1');
    const submit = screen.getByTestId('email-login-submit');

    // When
    const firstPress = fireEvent.press(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await fireEvent.press(submit);
    pending.settle();
    await firstPress;

    // Then
    expect(session.publicHttp.post).toHaveBeenCalledTimes(1);
  });
});
