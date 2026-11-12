import '@src/shared/i18n/init';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { MyPageMenuNavigationProvider } from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { NetworkError } from '@src/shared/errors';
import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import { AccountActionButtons } from './account-action-buttons';

describe('AccountActionButtons', () => {
  it('소셜 계정 탈퇴가 실패하면 확인 다이얼로그를 남겨 다시 누르거나 취소할 수 있다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.delete.mockRejectedValue(new NetworkError());
    const di = createTestDi({ ports: { httpClient } });
    di.queryClient.setQueryData(
      USER_QUERY_KEYS.me(),
      toUser(createCurrentUserDto({ providers: ['KAKAO'] })),
    );
    await renderScreen(
      <MyPageMenuNavigationProvider>
        <AccountActionButtons />
      </MyPageMenuNavigationProvider>,
      { di, withOverlay: true },
    );
    // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않는다
    const opening = fireEvent.press(screen.getByRole('button', { name: '탈퇴하기' }));
    await screen.findByText('회원 탈퇴');

    // When
    const confirm = screen.getAllByRole('button', { name: '탈퇴하기' }).at(-1);
    if (confirm == null) {
      throw new Error('확인 버튼이 없습니다');
    }
    await fireEvent.press(confirm);

    // Then
    expect(httpClient.delete).toHaveBeenCalledWith('v1/auth/account', expect.anything());
    expect(screen.getByText('회원 탈퇴')).toBeOnTheScreen();
    expect(confirm).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    await opening;
  });
});
