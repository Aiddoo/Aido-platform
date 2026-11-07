import '@src/shared/i18n/init';
import type { ClipboardGateway } from '@src/core/ports/clipboard-gateway';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { i18n } from '@src/shared/i18n';
import { fireEvent, screen } from '@testing-library/react-native';

import { createCurrentUserDto } from '../__tests__/user.fixtures';
import { toUser } from '../apis/user.mapper';
import { USER_QUERY_KEYS } from '../constants/user-query-keys';
import { ProfileRow } from './profile-row';

function createClipboardStub(copy: ClipboardGateway['copy']): ClipboardGateway {
  return { copy, hasContent: jest.fn(), paste: jest.fn() };
}

async function renderProfileRow(clipboard: ClipboardGateway) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), toUser(createCurrentUserDto()));
  await renderUi(<ProfileRow tierChip={null} />, { queryClient, di: { clipboard } });
}

describe('해시태그 복사', () => {
  it('복사하면 완료를 알린다', async () => {
    // Given
    await renderProfileRow(createClipboardStub(jest.fn().mockResolvedValue(undefined)));

    // When
    await fireEvent.press(screen.getByLabelText(i18n.t('user:profile.copyTag')));

    // Then
    expect(await screen.findAllByText(i18n.t('user:profile.tagCopied'))).not.toHaveLength(0);
  });

  it('복사에 실패하면 실패를 알린다', async () => {
    // Given
    await renderProfileRow(createClipboardStub(jest.fn().mockRejectedValue(new Error('denied'))));

    // When
    await fireEvent.press(screen.getByLabelText(i18n.t('user:profile.copyTag')));

    // Then
    expect(await screen.findAllByText(i18n.t('user:profile.tagCopyFailed'))).not.toHaveLength(0);
    expect(screen.queryByText(i18n.t('user:profile.tagCopied'))).toBeNull();
  });
});
