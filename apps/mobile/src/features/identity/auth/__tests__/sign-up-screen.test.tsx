import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createMemoryTokenStore,
  createPendingResponse,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useIsFocused } from 'expo-router';

import SignUpRoute from '../../../../../app/(auth)/sign-up';
import { givenAndroidBack, typeVerificationCode } from './auth-step.test-utils';
import {
  createAuthApiError,
  createAuthTokensDto,
  createRegisterDto,
  createResendVerificationDto,
} from './auth.fixtures';
import { createAuthSessionStoreStub } from './create-auth-session-store-stub';

const NAME = '아이두';
const EMAIL = 'user@example.com';
const PASSWORD = 'FakePass123';
const CODE = '123456';
const NAME_PLACEHOLDER = '닉네임을 입력해주세요';
const EMAIL_PLACEHOLDER = 'example@email.com';
const PASSWORD_PLACEHOLDER = '비밀번호를 입력해주세요';
const CONFIRM_PLACEHOLDER = '비밀번호를 다시 입력해주세요';
const SIGN_UP_TITLE = '회원가입';
const PASSWORD_STEP_TITLE = '비밀번호 설정';
const VERIFICATION_STEP_TITLE = '이메일 인증';
const CODE_SENT_TO = 'us****@example.com로\n발송된 코드를 입력해주세요';
const TERMS_TITLE = '아이두를 시작할게요';
const START = '동의하고 시작하기';
const INVITE_CODE = '초대 코드가 있나요?';
const DISALLOWED_CHARACTER_NOTICE = '쓸 수 없는 문자가 있어요. 특수문자는 @$!%*#?&만 쓸 수 있어요';
const REGISTER_PATH = 'v1/auth/register';
const VERIFY_PATH = 'v1/auth/verify-email';
const RESEND_PATH = 'v1/auth/resend-verification';

async function renderSignUp(httpClient: ReturnType<typeof createHttpClientStub>) {
  const analytics = createAnalyticsStub();
  const authSessionStore = createAuthSessionStoreStub('unauthenticated');
  const tokenStore = createMemoryTokenStore();
  await renderScreen(<SignUpRoute />, {
    di: createTestDi({
      ports: { httpClient, analytics, tokenStore },
      seeds: { authSessionStore },
    }),
    withOverlay: true,
  });
  return {
    authSessionStore,
    tokenStore,
    viewedSteps: () =>
      analytics.trackEvent.mock.calls.flatMap(([name, properties]) =>
        name === 'auth_signup_step_viewed' ? [properties] : [],
      ),
  };
}

function getNextButton() {
  return screen.getByRole('button', { name: '다음' });
}

async function fillName(name = NAME) {
  await fireEvent.changeText(await screen.findByPlaceholderText(NAME_PLACEHOLDER), name);
  await fireEvent.press(getNextButton());
  return screen.findByPlaceholderText(EMAIL_PLACEHOLDER);
}

async function goToPasswordStep() {
  await fireEvent.changeText(await fillName(), EMAIL);
  await fireEvent.press(getNextButton());
  return screen.findByPlaceholderText(PASSWORD_PLACEHOLDER);
}

async function goToPasswordConfirmStep() {
  await fireEvent.changeText(await goToPasswordStep(), PASSWORD);
  await fireEvent.press(getNextButton());
  return screen.findByPlaceholderText(CONFIRM_PLACEHOLDER);
}

async function openTermsSheet() {
  await fireEvent.changeText(await goToPasswordConfirmStep(), PASSWORD);
  await fireEvent.press(getNextButton());
  await screen.findByText(TERMS_TITLE);
}

async function agreeAll() {
  await fireEvent.press(screen.getByText('모두 동의'));
  await waitFor(() => expect(screen.getByRole('button', { name: START })).toBeEnabled());
}

async function goToVerificationStep(httpClient: ReturnType<typeof createHttpClientStub>) {
  httpClient.post.mockImplementation(respondByPath({ [REGISTER_PATH]: ok(createRegisterDto()) }));
  await openTermsSheet();
  await agreeAll();
  await fireEvent.press(screen.getByRole('button', { name: START }));
  await screen.findByText(CODE_SENT_TO);
}

describe('SignUpRoute', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;

  beforeEach(() => {
    httpClient = createHttpClientStub();
  });

  describe('이름·이메일 단계', () => {
    it('이름, 이메일, 비밀번호, 확인 순서로 진행하며 제목을 바꾸고 단계마다 한 번씩 기록한다', async () => {
      // Given
      const { viewedSteps } = await renderSignUp(httpClient);
      expect(await screen.findByText(SIGN_UP_TITLE)).toBeTruthy();
      expect(getNextButton()).toBeDisabled();

      // When
      await goToPasswordConfirmStep();

      // Then
      expect(screen.getByText(PASSWORD_STEP_TITLE)).toBeTruthy();
      expect(screen.queryByText(SIGN_UP_TITLE)).toBeNull();
      expect(screen.queryByPlaceholderText(NAME_PLACEHOLDER)).toBeNull();
      expect(viewedSteps()).toEqual([
        { step: 'name' },
        { step: 'email' },
        { step: 'password' },
        { step: 'passwordConfirm' },
      ]);
    });

    it('초대 코드 입력은 이름·이메일 단계에서만 열 수 있다', async () => {
      // Given
      await renderSignUp(httpClient);
      await fireEvent.press(await screen.findByLabelText(INVITE_CODE));
      expect(router.push).toHaveBeenCalledWith('/invite');

      // When
      await goToPasswordStep();

      // Then
      expect(screen.queryByLabelText(INVITE_CODE)).toBeNull();
    });

    it('이름 다음 이메일 단계로 넘어가도 이름 칸을 다시 마운트하지 않아 키보드가 내려가지 않는다', async () => {
      // Given
      await renderSignUp(httpClient);
      const nameInput = await screen.findByPlaceholderText(NAME_PLACEHOLDER);

      // When
      await fillName();

      // Then
      expect(screen.getByPlaceholderText(NAME_PLACEHOLDER)).toBe(nameInput);
    });

    it('이메일이 형식에 맞을 때만 다음 단계로 갈 수 있고 오류 문구는 칸을 벗어난 뒤에 보인다', async () => {
      // Given
      await renderSignUp(httpClient);
      const emailInput = await fillName();

      // When
      await fireEvent.changeText(emailInput, 'a@aido');

      // Then
      expect(getNextButton()).toBeDisabled();
      expect(screen.queryByText('올바른 이메일 형식이 아니에요')).toBeNull();

      // When
      await fireEvent.changeText(emailInput, EMAIL);

      // Then
      expect(getNextButton()).toBeEnabled();
    });

    it('이메일 칸을 벗어났을 때 형식이 틀리면 오류 문구를 보인다', async () => {
      // Given
      await renderSignUp(httpClient);
      const emailInput = await fillName();
      await fireEvent.changeText(emailInput, 'not-an-email');

      // When
      await fireEvent(emailInput, 'blur');

      // Then
      expect(await screen.findByText('올바른 이메일 형식이 아니에요')).toBeTruthy();
    });

    it('이메일이 틀린 채 닉네임 칸에서 키보드 다음을 눌러도 비밀번호 단계로 가지 않는다', async () => {
      // Given
      await renderSignUp(httpClient);
      const nameInput = await screen.findByPlaceholderText(NAME_PLACEHOLDER);
      await fireEvent.changeText(await fillName(), 'not-an-email');

      // When
      await fireEvent(nameInput, 'submitEditing');

      // Then
      expect(screen.queryByPlaceholderText(PASSWORD_PLACEHOLDER)).toBeNull();
    });

    it('이메일 단계에서 Android 뒤로 가기는 이름 단계로 한 칸 돌아가고 적은 이름을 지킨다', async () => {
      // Given
      const androidBack = givenAndroidBack();
      await renderSignUp(httpClient);
      await fireEvent.changeText(await fillName(), EMAIL);

      // When
      await androidBack.press();

      // Then
      expect(screen.queryByPlaceholderText(EMAIL_PLACEHOLDER)).toBeNull();
      expect(screen.getByDisplayValue(NAME)).toBeTruthy();
      expect(getNextButton()).toBeEnabled();
    });
  });

  describe('비밀번호 단계', () => {
    it('비밀번호 단계에서 Android 뒤로 가기로 이전 단계로 돌아가도 적은 닉네임과 이메일이 남는다', async () => {
      // Given
      const androidBack = givenAndroidBack();
      await renderSignUp(httpClient);
      await goToPasswordStep();

      // When
      await androidBack.press();

      // Then
      expect(await screen.findByText(SIGN_UP_TITLE)).toBeTruthy();
      expect(screen.getByDisplayValue(NAME)).toBeTruthy();
      expect(screen.getByDisplayValue(EMAIL)).toBeTruthy();
      expect(getNextButton()).toBeEnabled();
    });

    it('비밀번호 확인을 다르게 적으면 칸을 벗어나기 전에도 일치하지 않는다는 이유를 보인다', async () => {
      // Given
      await renderSignUp(httpClient);
      const confirmInput = await goToPasswordConfirmStep();
      expect(screen.queryByText('비밀번호가 일치하지 않아요')).toBeNull();

      // When
      await fireEvent.changeText(confirmInput, 'Mismatch99x');

      // Then
      expect(await screen.findByText('비밀번호가 일치하지 않아요')).toBeTruthy();
      expect(getNextButton()).toBeDisabled();
    });

    it('비밀번호 확인이 다른 채 비밀번호 칸에서 키보드 다음을 눌러도 약관 시트를 열지 않는다', async () => {
      // Given
      await renderSignUp(httpClient);
      const confirmInput = await goToPasswordConfirmStep();
      await fireEvent.changeText(confirmInput, 'Different123');

      // When
      await fireEvent(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), 'submitEditing');

      // Then
      expect(screen.queryByText(TERMS_TITLE)).toBeNull();
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it.each(['abcd1234.', 'abcd 1234', '비밀번호abcd1234'])(
      '비밀번호 %j처럼 쓸 수 없는 문자가 있으면 규칙 아래에 이유를 보이고 다음으로 가지 않는다',
      async (password) => {
        // Given
        await renderSignUp(httpClient);
        const passwordInput = await goToPasswordStep();

        // When
        await fireEvent.changeText(passwordInput, password);

        // Then
        expect(screen.getByText(DISALLOWED_CHARACTER_NOTICE)).toBeTruthy();
        expect(getNextButton()).toBeDisabled();
      },
    );

    it('허용한 특수문자만 쓴 비밀번호는 이유 없이 다음으로 갈 수 있다', async () => {
      // Given
      await renderSignUp(httpClient);
      const passwordInput = await goToPasswordStep();

      // When
      await fireEvent.changeText(passwordInput, 'abcd1234!');

      // Then
      expect(screen.queryByText(DISALLOWED_CHARACTER_NOTICE)).toBeNull();
      expect(getNextButton()).toBeEnabled();
    });
  });

  describe('약관 동의와 가입', () => {
    it('유효한 비밀번호 두 번을 적으면 약관 시트를 열어 필수 동의 전에는 가입을 요청하지 않는다', async () => {
      // Given
      await renderSignUp(httpClient);

      // When
      await openTermsSheet();

      // Then
      expect(screen.getByRole('button', { name: START })).toBeDisabled();
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it('동의하고 시작하면 적은 값과 동의를 한 번 보내고 인증 단계에서 가린 주소를 보인다', async () => {
      // Given
      const pending = createPendingResponse(ok(createRegisterDto()));
      httpClient.post.mockReturnValue(pending.response);
      const { viewedSteps } = await renderSignUp(httpClient);
      await openTermsSheet();
      await agreeAll();
      const start = screen.getByRole('button', { name: START });

      // When
      const firstPress = fireEvent.press(start);
      await waitFor(() => expect(httpClient.post).toHaveBeenCalled());
      const secondPress = fireEvent.press(start);
      pending.settle();
      await Promise.all([firstPress, secondPress]);

      // Then
      expect(await screen.findByText(CODE_SENT_TO)).toBeTruthy();
      expect(screen.getByText(VERIFICATION_STEP_TITLE)).toBeTruthy();
      expect(screen.queryByLabelText(INVITE_CODE)).toBeNull();
      expect(httpClient.post).toHaveBeenCalledTimes(1);
      expect(httpClient.post).toHaveBeenCalledWith(REGISTER_PATH, {
        email: EMAIL,
        password: PASSWORD,
        passwordConfirm: PASSWORD,
        name: NAME,
        termsAgreed: true,
        privacyAgreed: true,
        marketingAgreed: true,
        marketingPushAgreed: true,
      });
      expect(viewedSteps().at(-1)).toEqual({ step: 'verification' });
    });

    it('가입은 됐지만 인증 메일을 보내지 못했으면 다시 보내기를 안내하고 인증 단계로 간다', async () => {
      // Given
      httpClient.post.mockResolvedValue(ok(createRegisterDto({ emailSent: false })));
      await renderSignUp(httpClient);
      await openTermsSheet();
      await agreeAll();

      // When
      await fireEvent.press(screen.getByRole('button', { name: START }));

      // Then
      expect(await screen.findByText(CODE_SENT_TO)).toBeTruthy();
      expect(
        await screen.findAllByText(
          '가입은 됐지만 인증 메일을 보내지 못했어요. 잠시 뒤 다시 보내기를 눌러주세요',
        ),
      ).toHaveLength(1);
    });

    it('이미 가입한 이메일이면 로그인하러 가는 안내를 한 번 띄우고 시트와 입력값을 지킨다', async () => {
      // Given
      httpClient.post.mockResolvedValue(
        fail(createAuthApiError({ code: 'EMAIL_0501', status: 409, message: '이미 가입됨' })),
      );
      await renderSignUp(httpClient);
      await openTermsSheet();
      await agreeAll();
      await fireEvent.press(screen.getByRole('button', { name: START }));
      expect(await screen.findAllByText('이미 가입된 이메일이에요')).toHaveLength(1);
      expect(screen.queryByText('이미 가입됨')).toBeNull();
      expect(screen.getByText(TERMS_TITLE)).toBeTruthy();
      expect(screen.getAllByDisplayValue(PASSWORD)).toHaveLength(2);

      // When
      await fireEvent.press(screen.getByText('로그인하기'));

      // Then
      expect(router.replace).toHaveBeenCalledWith('/(auth)/email-login');
    });

    it('연결이 끊겨 가입이 실패하면 한 번 안내하고 시트를 열어 둬 바로 다시 누를 수 있다', async () => {
      // Given
      httpClient.post.mockRejectedValue(new NetworkError());
      await renderSignUp(httpClient);
      await openTermsSheet();
      await agreeAll();

      // When
      await fireEvent.press(screen.getByRole('button', { name: START }));

      // Then
      expect(await screen.findAllByText(new NetworkError().message)).toHaveLength(1);
      expect(screen.getByText(TERMS_TITLE)).toBeTruthy();
      expect(screen.getByRole('button', { name: START })).toBeEnabled();
      expect(screen.getAllByDisplayValue(PASSWORD)).toHaveLength(2);
      expect(screen.queryByText(CODE_SENT_TO)).toBeNull();
    });
  });

  describe('이메일 인증 단계', () => {
    it('코드를 다 적으면 가입한 주소와 코드로 확인하고 받은 토큰으로 로그인 상태가 된다', async () => {
      // Given
      const { authSessionStore, tokenStore } = await renderSignUp(httpClient);
      await goToVerificationStep(httpClient);
      httpClient.post.mockImplementation(
        respondByPath({ [VERIFY_PATH]: ok(createAuthTokensDto()) }),
      );

      // When
      await typeVerificationCode(CODE);

      // Then
      await waitFor(() => expect(authSessionStore.getSnapshot().status).toBe('authenticated'));
      expect(httpClient.post).toHaveBeenLastCalledWith(VERIFY_PATH, { email: EMAIL, code: CODE });
      await expect(tokenStore.getRefreshToken()).resolves.toBe(createAuthTokensDto().refreshToken);
    });

    it.each([
      ['틀린', 'EMAIL_0504', '인증 코드가 올바르지 않아요'],
      ['만료된', 'EMAIL_0505', '인증 코드가 만료되었어요. 다시 요청해주세요.'],
    ] as const)(
      '%s 코드면 한 번 안내하고 인증 단계에 머물러 칸을 비운다',
      async (_, code, message) => {
        // Given
        const { authSessionStore } = await renderSignUp(httpClient);
        await goToVerificationStep(httpClient);
        httpClient.post.mockImplementation(
          respondByPath({
            [VERIFY_PATH]: fail(createAuthApiError({ code, status: 400, message })),
          }),
        );

        // When
        await typeVerificationCode(CODE);

        // Then
        expect(await screen.findAllByText(message)).toHaveLength(1);
        expect(screen.getByText(CODE_SENT_TO)).toBeTruthy();
        await waitFor(() =>
          expect(screen.getByLabelText(/One-time passcode input/).props.value).toBe(''),
        );
        expect(authSessionStore.getSnapshot().status).toBe('unauthenticated');
      },
    );

    it('코드를 다시 보내면 가입한 주소로 요청하고 알린 뒤 서버가 준 시간만큼 다시 보낼 수 없다', async () => {
      // Given
      await renderSignUp(httpClient);
      await goToVerificationStep(httpClient);
      httpClient.post.mockImplementation(
        respondByPath({
          [RESEND_PATH]: ok(createResendVerificationDto({ retryAfterSeconds: 30 })),
        }),
      );

      // When
      await fireEvent.press(screen.getByText('코드 다시 보내기'));

      // Then
      expect(await screen.findByText('30초 뒤에 다시 보낼 수 있어요')).toBeTruthy();
      expect(await screen.findAllByText('인증 코드를 다시 보냈어요')).toHaveLength(1);
      expect(httpClient.post).toHaveBeenLastCalledWith(RESEND_PATH, { email: EMAIL });
    });

    // 가입 뒤 인증 단계는 확인 단계를 바꿔 넣어(replace) 뒤로 가면 확인 칸이 닫힌 비밀번호 단계다. 리팩터링 전후가 같은지 지킨다
    it('인증 단계에서 Android 뒤로 가기는 적은 비밀번호를 둔 비밀번호 단계로 돌아간다', async () => {
      // Given
      const androidBack = givenAndroidBack();
      await renderSignUp(httpClient);
      await goToVerificationStep(httpClient);

      // When
      await androidBack.press();

      // Then
      expect(await screen.findByText(PASSWORD_STEP_TITLE)).toBeTruthy();
      expect(screen.queryByText(CODE_SENT_TO)).toBeNull();
      expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER).props.value).toBe(PASSWORD);
      expect(screen.queryByPlaceholderText(CONFIRM_PLACEHOLDER)).toBeNull();
    });
  });

  describe('다시 그리기', () => {
    // 단계 조립(폼과 단계를 가진 화면)만 Android 뒤로 가기를 화면 포커스와 묶어, 그 호출 수가 화면이 그려진 횟수다
    function countScreenRenders() {
      return jest.mocked(useIsFocused).mock.calls.length;
    }

    it('칸에 글자를 쳐도 단계 조립은 다시 그려지지 않는다', async () => {
      // Given
      await renderSignUp(httpClient);
      const nameInput = await screen.findByPlaceholderText(NAME_PLACEHOLDER);
      const renderCountOnName = countScreenRenders();

      // When
      await fireEvent.changeText(nameInput, '아');
      await fireEvent.changeText(nameInput, '아이');
      await fireEvent.changeText(nameInput, NAME);
      await waitFor(() => expect(getNextButton()).toBeEnabled());
      const renderCountAfterTyping = countScreenRenders();
      await fireEvent.press(getNextButton());
      await screen.findByPlaceholderText(EMAIL_PLACEHOLDER);

      // Then
      expect(renderCountAfterTyping).toBe(renderCountOnName);
      // 단계가 바뀔 때는 다시 그려져, 위 두 값이 같은 것이 세지 못해서가 아니다
      expect(countScreenRenders()).toBeGreaterThan(renderCountAfterTyping);
    });
  });

  describe('두 번 누르기', () => {
    it('동의하고 시작하기를 같은 프레임에 두 번 눌러도 가입 요청은 한 번이다', async () => {
      // Given
      const pending = createPendingResponse(ok(createRegisterDto()));
      httpClient.post.mockReturnValue(pending.response);
      await renderSignUp(httpClient);
      await openTermsSheet();
      await agreeAll();
      const start = screen.getByRole('button', { name: START });

      // When
      await act(async () => {
        await fireEvent.press(start);
        await fireEvent.press(start);
      });
      await waitFor(() => expect(httpClient.post).toHaveBeenCalled());
      pending.settle();

      // Then
      expect(await screen.findByText(CODE_SENT_TO)).toBeTruthy();
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    describe('가입 뒤', () => {
      setupFakeTimersPerTest();

      it('가입하면 인증 단계로 바뀌어 연타 가드가 지난 뒤에도 시작하기를 다시 누를 수 없다', async () => {
        // Given
        httpClient.post.mockResolvedValue(ok(createRegisterDto()));
        await renderSignUp(httpClient);
        await openTermsSheet();
        await agreeAll();

        // When
        await fireEvent.press(screen.getByRole('button', { name: START }));
        await act(() => jest.advanceTimersByTimeAsync(1_000));

        // Then
        expect(screen.getByText(CODE_SENT_TO)).toBeTruthy();
        expect(screen.queryByRole('button', { name: START })).toBeNull();
        expect(httpClient.post).toHaveBeenCalledTimes(1);
      });
    });
  });
});
