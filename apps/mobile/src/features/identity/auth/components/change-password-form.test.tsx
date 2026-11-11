import '@src/shared/i18n/init';
import { err, ok } from '@src/core/errors/result';
import { createPendingResponse } from '@src/testing/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ACCOUNT_A_TOKENS, createAuthSession } from '../__tests__/auth-session.test-utils';
import { createAuthApiError } from '../__tests__/auth.fixtures';
import { ChangePasswordForm } from './change-password-form';

async function renderChangePasswordForm(session: ReturnType<typeof createAuthSession>) {
  await render(
    <ChangePasswordForm stepTitles={{ currentPassword: '현재', newPassword: '새 비밀번호' }} />,
    { wrapper: session.Wrapper },
  );
}

async function fillAllSteps() {
  await fireEvent.changeText(
    await screen.findByPlaceholderText('현재 비밀번호를 입력해주세요'),
    'Current123',
  );
  await fireEvent.press(screen.getByText('다음'));
  await fireEvent.changeText(
    await screen.findByPlaceholderText('새 비밀번호를 입력해주세요'),
    'NewPass1234',
  );
  await fireEvent.press(screen.getByText('다음'));
  await fireEvent.changeText(
    await screen.findByPlaceholderText('새 비밀번호를 다시 입력해주세요'),
    'NewPass1234',
  );
}

describe('비밀번호 변경 폼', () => {
  it('새 비밀번호를 적어도 확인 칸에 적기 전에는 일치하지 않는다는 오류를 보이지 않는다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    await renderChangePasswordForm(session);
    await fireEvent.changeText(
      await screen.findByPlaceholderText('현재 비밀번호를 입력해주세요'),
      'Current123',
    );
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText('새 비밀번호를 입력해주세요'),
      'NewPass1234',
    );

    // When
    await fireEvent.press(screen.getByText('다음'));
    const confirmInput = await screen.findByPlaceholderText('새 비밀번호를 다시 입력해주세요');

    // Then
    expect(screen.queryByText('비밀번호가 일치하지 않아요')).toBeNull();

    // When
    await fireEvent.changeText(confirmInput, 'NewPass12');

    // Then
    expect(await screen.findByText('비밀번호가 일치하지 않아요')).toBeTruthy();
  });

  it('변경 버튼을 연달아 눌러도 요청은 한 번이다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    const pending = createPendingResponse(ok({ message: '변경됨' }));
    session.authHttp.patch.mockReturnValue(pending.response);
    await renderChangePasswordForm(session);
    await fillAllSteps();

    const submit = screen.getByRole('button', { name: '비밀번호 변경' });

    // When
    await fireEvent.press(submit);
    await fireEvent.press(submit);

    // Then
    expect(session.authHttp.patch).toHaveBeenCalledTimes(1);
    pending.settle();
  });

  it('서버가 거절하면 이유를 알리고 두 단계에 적은 값을 지킨다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.authHttp.patch.mockResolvedValue(
      err(createAuthApiError({ status: 400, message: '서버가 거절한 이유' })),
    );
    await render(
      <ChangePasswordForm stepTitles={{ currentPassword: '현재', newPassword: '새 비밀번호' }} />,
      { wrapper: session.Wrapper },
    );
    await fireEvent.changeText(
      await screen.findByPlaceholderText('현재 비밀번호를 입력해주세요'),
      'Current123',
    );
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText('새 비밀번호를 입력해주세요'),
      'NewPass1234',
    );
    await fireEvent.press(screen.getByText('다음'));
    await fireEvent.changeText(
      await screen.findByPlaceholderText('새 비밀번호를 다시 입력해주세요'),
      'NewPass1234',
    );

    // When
    await fireEvent.press(screen.getByText('비밀번호 변경'));

    // Then
    await waitFor(() => expect(session.authHttp.patch).toHaveBeenCalledTimes(1));
    expect(await screen.findAllByText('서버가 거절한 이유')).not.toHaveLength(0);
    expect(screen.getAllByDisplayValue('NewPass1234')).toHaveLength(2);
  });
});
