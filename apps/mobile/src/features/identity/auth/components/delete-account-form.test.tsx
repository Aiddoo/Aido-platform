import '@src/shared/i18n/init';
import { err } from '@src/core/errors/result';
import { i18n } from '@src/shared/i18n';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ACCOUNT_A_TOKENS, createAuthSession } from '../__tests__/auth-session.test-utils';
import { createAuthApiError } from '../__tests__/auth.fixtures';
import { DeleteAccountForm } from './delete-account-form';

describe('DeleteAccountForm', () => {
  it('비밀번호가 틀리면 토스트 대신 그 칸에 알리고 적은 값을 지킨다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.authHttp.delete.mockResolvedValue(
      err(createAuthApiError({ code: 'USER_0602', status: 401 })),
    );
    await render(
      <OverlayProvider>
        <DeleteAccountForm title="탈퇴" footer={null} />
      </OverlayProvider>,
      { wrapper: session.Wrapper },
    );
    await fireEvent.changeText(
      await screen.findByPlaceholderText('비밀번호를 입력해주세요'),
      'wrong-pass1',
    );
    // 제출은 확인 다이얼로그의 답을 기다리는 동안 끝나지 않는다
    const submitting = fireEvent.press(screen.getByRole('button', { name: '탈퇴하기' }));
    await screen.findByText('회원 탈퇴');

    // When
    const [confirm] = screen.getAllByRole('button', { name: '탈퇴하기' }).slice(-1);
    if (confirm == null) {
      throw new Error('confirm button required');
    }
    await fireEvent.press(confirm);
    await submitting;

    // Then
    expect(await screen.findByText('비밀번호가 일치하지 않아요')).toBeTruthy();
    expect(screen.getByDisplayValue('wrong-pass1')).toBeTruthy();
    expect(screen.queryByText(i18n.t('errors:USER_0602'))).toBeNull();
    await expect(session.tokenStore.getRefreshToken()).resolves.toBe(ACCOUNT_A_TOKENS.refreshToken);
  });
});
