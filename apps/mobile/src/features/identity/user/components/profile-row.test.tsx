import '@src/shared/i18n/init';
import { i18n } from '@src/shared/i18n';
import { createClipboardGatewayStub, createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import { createCurrentUserDto } from '../__tests__/user.fixtures';
import { toUser } from '../apis/user.mapper';
import { MyPageMenuNavigationProvider } from '../hooks/use-my-page-menu-navigation';
import { USER_QUERY_KEYS } from '../queries/user-query-keys';
import { ProfileRow } from './profile-row';

async function renderProfileRow(clipboard: ReturnType<typeof createClipboardGatewayStub>) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), toUser(createCurrentUserDto()));
  await renderScreen(
    <MyPageMenuNavigationProvider>
      <ProfileRow tierChip={null} />
    </MyPageMenuNavigationProvider>,
    { queryClient, di: { clipboard } },
  );
}

describe('해시태그 복사', () => {
  it('복사하면 완료를 알린다', async () => {
    // Given
    const clipboard = createClipboardGatewayStub();
    clipboard.copy.mockResolvedValue(undefined);
    await renderProfileRow(clipboard);

    // When
    await fireEvent.press(screen.getByLabelText(i18n.t('user:profile.copyTag')));

    // Then
    expect(await screen.findAllByText(i18n.t('user:profile.tagCopied'))).not.toHaveLength(0);
  });

  it('복사에 실패하면 실패를 알린다', async () => {
    // Given
    const clipboard = createClipboardGatewayStub();
    clipboard.copy.mockRejectedValue(new Error('denied'));
    await renderProfileRow(clipboard);

    // When
    await fireEvent.press(screen.getByLabelText(i18n.t('user:profile.copyTag')));

    // Then
    expect(await screen.findAllByText(i18n.t('user:profile.tagCopyFailed'))).not.toHaveLength(0);
    expect(screen.queryByText(i18n.t('user:profile.tagCopied'))).toBeNull();
  });
});
