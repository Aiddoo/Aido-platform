import '@src/shared/i18n/init';
import type { ErrorCodeType } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useNavigation } from 'expo-router';

import ForgotPasswordScreen from '../../../../../app/(auth)/forgot-password';
import { givenAndroidBack, typeVerificationCode } from './auth-step.test-utils';
import {
  createAuthApiError,
  createForgotPasswordDto,
  createResetPasswordDto,
} from './auth.fixtures';

const EMAIL = 'user@example.com';
const CODE = '123456';
const NEW_PASSWORD = 'FakeNew1234';
const EMAIL_STEP_TITLE = '비밀번호를 재설정할\n이메일을 입력해주세요';
const CODE_STEP_TITLE = 'us****@example.com로\n발송된 코드를 입력해주세요';
const NEW_PASSWORD_STEP_TITLE = '영문 숫자를 포함한\n새 비밀번호를 설정해주세요';
const EMAIL_PLACEHOLDER = '이메일';
const NEW_PLACEHOLDER = '새 비밀번호를 입력해주세요';
const CONFIRM_PLACEHOLDER = '새 비밀번호를 다시 입력해주세요';
const SUBMIT = '비밀번호 재설정';
const FORGOT_PATH = 'v1/auth/forgot-password';
const RESET_PATH = 'v1/auth/reset-password';

async function renderForgotPassword(httpClient: ReturnType<typeof createHttpClientStub>) {
  const analytics = createAnalyticsStub();
  await renderScreen(<ForgotPasswordScreen />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
  });
  return {
    viewedSteps: () =>
      analytics.trackEvent.mock.calls.flatMap(([name, properties]) =>
        name === 'auth_password_reset_step_viewed' ? [properties] : [],
      ),
  };
}

async function pressNext() {
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
}

async function fillEmailStep(email = EMAIL) {
  await fireEvent.changeText(await screen.findByPlaceholderText(EMAIL_PLACEHOLDER), email);
  await pressNext();
  await screen.findByText(CODE_STEP_TITLE);
}

async function fillNewPasswordSteps(confirm = NEW_PASSWORD) {
  await fireEvent.changeText(await screen.findByPlaceholderText(NEW_PLACEHOLDER), NEW_PASSWORD);
  await pressNext();
  await fireEvent.changeText(await screen.findByPlaceholderText(CONFIRM_PLACEHOLDER), confirm);
}

async function fillAllSteps() {
  await fillEmailStep();
  await typeVerificationCode(CODE);
  await fillNewPasswordSteps();
}

function getCodeInput() {
  return screen.getByLabelText(/One-time passcode input/);
}

describe('ForgotPasswordScreen', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;

  beforeEach(() => {
    httpClient = createHttpClientStub();
  });

  it('이메일, 인증 코드, 새 비밀번호, 확인 순서로 진행하고 단계마다 한 번씩 기록한다', async () => {
    // Given
    httpClient.post.mockResolvedValue(ok(createForgotPasswordDto()));
    const { viewedSteps } = await renderForgotPassword(httpClient);
    expect(await screen.findByText(EMAIL_STEP_TITLE)).toBeTruthy();

    // When
    await fillEmailStep();

    // Then
    expect(screen.queryByPlaceholderText(EMAIL_PLACEHOLDER)).toBeNull();

    // When
    await typeVerificationCode(CODE);

    // Then
    expect(await screen.findByText(NEW_PASSWORD_STEP_TITLE)).toBeTruthy();
    expect(screen.queryByPlaceholderText(CONFIRM_PLACEHOLDER)).toBeNull();

    // When
    await fillNewPasswordSteps();

    // Then
    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
    expect(viewedSteps()).toEqual([
      { step: 'email' },
      { step: 'verificationCode' },
      { step: 'newPassword' },
      { step: 'newPasswordConfirm' },
    ]);
  });

  it('이메일 형식이 맞을 때만 다음으로 갈 수 있고 코드를 요청하지 않는다', async () => {
    // Given
    await renderForgotPassword(httpClient);
    const emailInput = await screen.findByPlaceholderText(EMAIL_PLACEHOLDER);

    // When
    await fireEvent.changeText(emailInput, 'user@example');
    await fireEvent(emailInput, 'submitEditing');

    // Then
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(httpClient.post).not.toHaveBeenCalled();

    // When
    await fireEvent.changeText(emailInput, EMAIL);

    // Then
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });

  it('이메일로 코드를 요청하면 적은 주소로 한 번 보내고 그 주소를 가려 코드 단계에 보인다', async () => {
    // Given
    const pending = createPendingResponse(ok(createForgotPasswordDto()));
    httpClient.post.mockReturnValue(pending.response);
    await renderForgotPassword(httpClient);
    await fireEvent.changeText(await screen.findByPlaceholderText(EMAIL_PLACEHOLDER), EMAIL);

    const next = screen.getByRole('button', { name: '다음' });

    // When
    const firstPress = fireEvent.press(next);
    await waitFor(() => expect(httpClient.post).toHaveBeenCalled());
    const secondPress = fireEvent.press(next);
    pending.settle();
    await Promise.all([firstPress, secondPress]);

    // Then
    expect(await screen.findByText(CODE_STEP_TITLE)).toBeTruthy();
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith(FORGOT_PATH, { email: EMAIL });
  });

  it('코드 요청이 실패하면 한 번 안내하고 이메일 단계에 머물러 적은 주소를 지킨다', async () => {
    // Given
    httpClient.post.mockRejectedValue(new NetworkError());
    await renderForgotPassword(httpClient);
    await fireEvent.changeText(await screen.findByPlaceholderText(EMAIL_PLACEHOLDER), EMAIL);

    // When
    await pressNext();

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).toHaveLength(1);
    expect(screen.getByText(EMAIL_STEP_TITLE)).toBeTruthy();
    expect(screen.getByPlaceholderText(EMAIL_PLACEHOLDER).props.value).toBe(EMAIL);
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });

  it('코드를 다 적어도 서버에 묻지 않고 새 비밀번호 단계로 간다', async () => {
    // Given
    httpClient.post.mockResolvedValue(ok(createForgotPasswordDto()));
    await renderForgotPassword(httpClient);
    await fillEmailStep();

    // When
    await typeVerificationCode(CODE);

    // Then
    expect(await screen.findByText(NEW_PASSWORD_STEP_TITLE)).toBeTruthy();
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('코드를 다시 보내면 같은 주소로 요청하고 다시 보낼 때까지 남은 시간을 보인다', async () => {
    // Given
    httpClient.post.mockResolvedValue(ok(createForgotPasswordDto()));
    await renderForgotPassword(httpClient);
    await fillEmailStep();

    // When
    await fireEvent.press(screen.getByText('코드 다시 보내기'));

    // Then
    expect(await screen.findByText('60초 뒤에 다시 보낼 수 있어요')).toBeTruthy();
    expect(httpClient.post).toHaveBeenCalledTimes(2);
    expect(httpClient.post).toHaveBeenLastCalledWith(FORGOT_PATH, { email: EMAIL });
  });

  it('Android 뒤로 가기는 한 단계씩 돌아가고 적은 이메일과 새 비밀번호를 지킨다', async () => {
    // Given
    const androidBack = givenAndroidBack();
    httpClient.post.mockResolvedValue(ok(createForgotPasswordDto()));
    await renderForgotPassword(httpClient);
    await fillAllSteps();

    // When
    await androidBack.press();

    // Then
    expect(screen.queryByPlaceholderText(CONFIRM_PLACEHOLDER)).toBeNull();
    expect(screen.getByPlaceholderText(NEW_PLACEHOLDER).props.value).toBe(NEW_PASSWORD);

    // When
    await androidBack.press();
    await androidBack.press();

    // Then
    expect(await screen.findByText(EMAIL_STEP_TITLE)).toBeTruthy();
    expect(screen.getByPlaceholderText(EMAIL_PLACEHOLDER).props.value).toBe(EMAIL);
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });

  it('새 비밀번호 확인이 다르면 재설정 버튼이 꺼져 요청하지 않는다', async () => {
    // Given
    httpClient.post.mockResolvedValue(ok(createForgotPasswordDto()));
    await renderForgotPassword(httpClient);
    await fillEmailStep();
    await typeVerificationCode(CODE);

    // When
    await fillNewPasswordSteps('FakeNew12');
    await fireEvent(screen.getByPlaceholderText(CONFIRM_PLACEHOLDER), 'submitEditing');

    // Then
    expect(await screen.findByText('비밀번호가 일치하지 않아요')).toBeTruthy();
    expect(screen.getByRole('button', { name: SUBMIT })).toBeDisabled();
    expect(httpClient.post).not.toHaveBeenCalledWith(RESET_PATH, expect.anything());
  });

  it('재설정하면 이메일·코드·새 비밀번호를 한 번 보내고 성공을 알린 뒤 이메일 로그인으로 간다', async () => {
    // Given
    const pending = createPendingResponse(ok(createResetPasswordDto()));
    httpClient.post.mockImplementation(
      respondByPath({
        [FORGOT_PATH]: ok(createForgotPasswordDto()),
        [RESET_PATH]: () => pending.response,
      }),
    );
    await renderForgotPassword(httpClient);
    await fillAllSteps();

    const submit = screen.getByRole('button', { name: SUBMIT });

    // When
    await fireEvent.press(submit);
    await fireEvent.press(submit);
    pending.settle();

    // Then
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/email-login'));
    expect(router.replace).toHaveBeenCalledTimes(1);
    const resetCalls = httpClient.post.mock.calls.filter(([path]) => path === RESET_PATH);
    expect(resetCalls).toEqual([
      [
        RESET_PATH,
        { email: EMAIL, code: CODE, newPassword: NEW_PASSWORD, newPasswordConfirm: NEW_PASSWORD },
      ],
    ]);
    expect(await screen.findAllByText('비밀번호가 재설정되었어요')).toHaveLength(1);
  });

  it.each<ErrorCodeType>(['VERIFY_0751', 'VERIFY_0752', 'VERIFY_0754'])(
    '%s로 코드가 거절되면 한 번 안내하고 코드 단계로 돌아가 칸을 비우며, 새 코드를 적으면 새 비밀번호를 지킨 채 다시 보낸다',
    async (code) => {
      // Given
      httpClient.post.mockImplementation(
        respondByPath({
          [FORGOT_PATH]: ok(createForgotPasswordDto()),
          [RESET_PATH]: fail(
            createAuthApiError({ code, status: 400, message: i18n.t(`errors:${code}`) }),
          ),
        }),
      );
      await renderForgotPassword(httpClient);
      await fillAllSteps();

      // When
      await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

      // Then
      expect(await screen.findAllByText(i18n.t(`errors:${code}`))).toHaveLength(1);
      expect(screen.getByText(CODE_STEP_TITLE)).toBeTruthy();
      expect(getCodeInput().props.value).toBe('');
      expect(router.replace).not.toHaveBeenCalled();

      // When
      httpClient.post.mockImplementation(
        respondByPath({ [RESET_PATH]: ok(createResetPasswordDto()) }),
      );
      await typeVerificationCode('654321');
      await pressNext();
      await fireEvent.press(await screen.findByRole('button', { name: SUBMIT }));

      // Then
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/email-login'));
      expect(httpClient.post).toHaveBeenLastCalledWith(RESET_PATH, {
        email: EMAIL,
        code: '654321',
        newPassword: NEW_PASSWORD,
        newPasswordConfirm: NEW_PASSWORD,
      });
    },
  );

  it('서버가 다른 이유로 거절하면 한 번 안내하고 마지막 단계에 머물러 적은 값을 지킨다', async () => {
    // Given
    httpClient.post.mockImplementation(
      respondByPath({
        [FORGOT_PATH]: ok(createForgotPasswordDto()),
        [RESET_PATH]: fail(createAuthApiError({ status: 400, message: '서버가 거절한 이유' })),
      }),
    );
    await renderForgotPassword(httpClient);
    await fillAllSteps();

    // When
    await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

    // Then
    expect(await screen.findAllByText('서버가 거절한 이유')).toHaveLength(1);
    expect(screen.getAllByDisplayValue(NEW_PASSWORD)).toHaveLength(2);
    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('연결이 끊겨 재설정이 실패하면 한 번 안내하고 마지막 단계에 머물러 적은 값을 지킨다', async () => {
    // Given
    httpClient.post.mockImplementation(
      respondByPath({
        [FORGOT_PATH]: ok(createForgotPasswordDto()),
        [RESET_PATH]: async () => {
          throw new NetworkError();
        },
      }),
    );
    await renderForgotPassword(httpClient);
    await fillAllSteps();

    // When
    await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).toHaveLength(1);
    expect(screen.getAllByDisplayValue(NEW_PASSWORD)).toHaveLength(2);
    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  describe('두 번 누르기와 기다리는 사이', () => {
    it('다음을 같은 프레임에 두 번 눌러도 코드 요청은 한 번이다', async () => {
      // Given
      const pending = createPendingResponse(ok(createForgotPasswordDto()));
      httpClient.post.mockReturnValue(pending.response);
      await renderForgotPassword(httpClient);
      await fireEvent.changeText(await screen.findByPlaceholderText(EMAIL_PLACEHOLDER), EMAIL);
      const next = screen.getByRole('button', { name: '다음' });

      // When
      await act(async () => {
        await fireEvent.press(next);
        await fireEvent.press(next);
      });
      pending.settle();

      // Then
      expect(await screen.findByText(CODE_STEP_TITLE)).toBeTruthy();
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it('재설정을 같은 프레임에 두 번 눌러도 요청은 한 번이다', async () => {
      // Given
      httpClient.post.mockResolvedValue(ok(createForgotPasswordDto()));
      await renderForgotPassword(httpClient);
      await fillAllSteps();
      const pending = createPendingResponse(ok(createResetPasswordDto()));
      httpClient.post.mockReturnValue(pending.response);
      const submit = screen.getByRole('button', { name: SUBMIT });

      // When
      await act(async () => {
        await fireEvent.press(submit);
        await fireEvent.press(submit);
      });
      pending.settle();

      // Then
      await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
      expect(httpClient.post.mock.calls.filter(([path]) => path === RESET_PATH)).toHaveLength(1);
    });

    it('코드를 다시 보내는 중에 이메일 단계로 돌아가면 다음 버튼도 그 요청을 기다린다', async () => {
      // Given
      const androidBack = givenAndroidBack();
      httpClient.post.mockResolvedValue(ok(createForgotPasswordDto()));
      await renderForgotPassword(httpClient);
      await fillEmailStep();
      const resend = createPendingResponse(ok(createForgotPasswordDto()));
      httpClient.post.mockReturnValue(resend.response);
      await fireEvent.press(screen.getByText('코드 다시 보내기'));

      // When
      await androidBack.press();

      // Then
      expect(await screen.findByText(EMAIL_STEP_TITLE)).toBeTruthy();
      expect(screen.queryByRole('button', { name: '다음' })).toBeNull();
      expect(httpClient.post).toHaveBeenCalledTimes(2);

      // When
      await act(async () => {
        resend.settle();
      });

      // Then
      expect(await screen.findByRole('button', { name: '다음' })).toBeEnabled();
    });

    it('재설정을 기다리는 사이 떠났으면 끝나도 로그인 화면으로 바꾸지 않는다', async () => {
      // Given
      let isFocused = true;
      jest.mocked(useNavigation).mockImplementation(() => ({
        isFocused: () => isFocused,
        getParent: () => undefined,
        addListener: () => () => undefined,
      }));
      httpClient.post.mockResolvedValue(ok(createForgotPasswordDto()));
      await renderForgotPassword(httpClient);
      await fillAllSteps();
      const pending = createPendingResponse(ok(createResetPasswordDto()));
      httpClient.post.mockReturnValue(pending.response);
      await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));

      // When
      isFocused = false;
      await act(async () => {
        pending.settle();
      });

      // Then
      expect(await screen.findAllByText('비밀번호가 재설정되었어요')).toHaveLength(1);
      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe('재설정 뒤 떠나는 동안', () => {
    setupFakeTimersPerTest();

    it('재설정해 로그인으로 바뀌는 동안 다시 눌러도 재설정 요청은 한 번이다', async () => {
      // Given
      httpClient.post.mockImplementation(
        respondByPath({
          [FORGOT_PATH]: ok(createForgotPasswordDto()),
          [RESET_PATH]: ok(createResetPasswordDto()),
        }),
      );
      await renderForgotPassword(httpClient);
      await fillAllSteps();
      // 잠긴 버튼은 이름 대신 로딩을 보여 이름으로 다시 찾지 못한다. 처음 찾은 버튼을 다시 누른다
      const submit = screen.getByRole('button', { name: SUBMIT });
      await fireEvent.press(submit);
      // 연타 가드(600ms)가 지난 뒤다. 화면은 바꾸는 전환이 끝나야 내려가 버튼이 아직 보인다
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(router.replace).toHaveBeenCalledTimes(1);

      // When
      await fireEvent.press(submit);
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post.mock.calls.filter(([path]) => path === RESET_PATH)).toHaveLength(1);
    });

    it('재설정을 기다리는 사이 떠났다가 끝난 뒤 돌아오면 적은 값이 남고 버튼이 잠겨 있지 않다', async () => {
      // Given
      let isFocused = true;
      jest.mocked(useNavigation).mockImplementation(() => ({
        isFocused: () => isFocused,
        getParent: () => undefined,
        addListener: () => () => undefined,
      }));
      const pending = createPendingResponse(ok(createResetPasswordDto()));
      httpClient.post.mockImplementation(
        respondByPath({
          [FORGOT_PATH]: ok(createForgotPasswordDto()),
          [RESET_PATH]: () => pending.response,
        }),
      );
      await renderForgotPassword(httpClient);
      await fillAllSteps();
      await fireEvent.press(screen.getByRole('button', { name: SUBMIT }));
      isFocused = false;

      // When
      await act(async () => {
        pending.settle();
      });
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      isFocused = true;

      // Then
      expect(screen.getByPlaceholderText(CONFIRM_PLACEHOLDER)).toHaveDisplayValue(NEW_PASSWORD);
      expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
      expect(router.replace).not.toHaveBeenCalled();
    });
  });
});
