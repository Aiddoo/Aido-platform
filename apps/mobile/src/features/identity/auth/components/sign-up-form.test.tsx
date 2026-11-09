import '@src/shared/i18n/init';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, Pressable } from 'react-native';

import { createAuthSession } from '../__tests__/auth-session.test-utils';
import { SignUpForm, type SignUpStepContexts } from './sign-up-form';

function SignUpHarness() {
  const stepper = useStepper<SignUpStepContexts>({
    id: 'sign-up-test',
    initial: { step: 'userInfo', context: {} },
  });

  return (
    <>
      <Pressable testID="back" onPress={() => stepper.history.back()} />
      <SignUpForm stepper={stepper} />
    </>
  );
}

describe('회원가입 폼', () => {
  it('비밀번호 단계에서 이전 단계로 돌아가도 적은 닉네임과 이메일이 남는다', async () => {
    // Given
    const session = createAuthSession();
    await render(<SignUpHarness />, { wrapper: session.Wrapper });
    await fireEvent.changeText(
      await screen.findByPlaceholderText('닉네임을 입력해주세요.'),
      '아이두',
    );
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText('example@email.com'),
      'a@aido.app',
    );
    await fireEvent.press(screen.getByText('다음'));
    await screen.findByPlaceholderText('비밀번호를 입력해주세요');

    // When
    await fireEvent.press(screen.getByTestId('back'));

    // Then
    expect(await screen.findByDisplayValue('아이두')).toBeTruthy();
  });

  it('유효한 비밀번호 두 번을 적으면 약관 시트를 열어 동의 전에는 가입을 요청하지 않는다', async () => {
    // Given
    const session = createAuthSession();
    await render(<SignUpHarness />, { wrapper: session.Wrapper });
    await fireEvent.changeText(
      await screen.findByPlaceholderText('닉네임을 입력해주세요.'),
      '아이두',
    );
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText('example@email.com'),
      'a@aido.app',
    );
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText('비밀번호를 입력해주세요'),
      'Password123',
    );
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText('비밀번호를 다시 입력해주세요'),
      'Password123',
    );

    // When
    await fireEvent.press(screen.getByText('다음'));

    // Then
    expect(session.publicHttp.post).not.toHaveBeenCalled();
  });

  it('이메일 칸을 벗어났을 때 형식이 틀리면 오류 문구를 보인다', async () => {
    // Given
    const session = createAuthSession();
    await render(<SignUpHarness />, { wrapper: session.Wrapper });
    await fireEvent.changeText(
      await screen.findByPlaceholderText('닉네임을 입력해주세요.'),
      '아이두',
    );
    await fireEvent.press(screen.getByText('다음'));
    const emailInput = await screen.findByPlaceholderText('example@email.com');
    await fireEvent.changeText(emailInput, 'not-an-email');

    // When
    await fireEvent(emailInput, 'blur');

    // Then
    expect(await screen.findByText('올바른 이메일 형식이 아니에요')).toBeTruthy();
  });

  it('이메일이 틀린 채 닉네임 칸에서 키보드 다음을 눌러도 비밀번호 단계로 가지 않는다', async () => {
    // Given
    const session = createAuthSession();
    await render(<SignUpHarness />, { wrapper: session.Wrapper });
    const nameInput = await screen.findByPlaceholderText('닉네임을 입력해주세요.');
    await fireEvent.changeText(nameInput, '아이두');
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText('example@email.com'),
      'not-an-email',
    );

    // When
    await fireEvent(nameInput, 'submitEditing');

    // Then
    expect(screen.queryByPlaceholderText('비밀번호를 입력해주세요')).toBeNull();
  });

  it('비밀번호 확인이 다른 채 비밀번호 칸에서 키보드 다음을 눌러도 약관 시트를 열지 않는다', async () => {
    // Given
    const session = createAuthSession();
    await render(<SignUpHarness />, { wrapper: session.Wrapper });
    await fireEvent.changeText(
      await screen.findByPlaceholderText('닉네임을 입력해주세요.'),
      '아이두',
    );
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText('example@email.com'),
      'a@aido.app',
    );
    await fireEvent.press(screen.getByText('다음'));
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const passwordInput = await screen.findByPlaceholderText('비밀번호를 입력해주세요');
    await fireEvent.changeText(passwordInput, 'Password123');
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText('비밀번호를 다시 입력해주세요'),
      'Different123',
    );

    // When
    await fireEvent(passwordInput, 'submitEditing');

    // Then
    expect(dismiss).not.toHaveBeenCalled();
  });
});
