import '@src/shared/i18n/init';
import { err, ok } from '@src/core/errors/result';
import { createAuthApiError } from '@src/features/identity/auth/__tests__/auth.fixtures';
import { createHttpClientStub } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RemindNudgeBottomSheet } from './nudge-bottom-sheet';

async function renderSheet() {
  const httpClient = createHttpClientStub();
  const onOpenChange = jest.fn();
  await renderScreen(
    <RemindNudgeBottomSheet
      receiver={{ id: 'friend-1', displayName: '민지' }}
      isOpen
      onOpenChange={onOpenChange}
    />,
    { di: { httpClient }, withOverlay: true, withLocalDate: true },
  );

  return { httpClient, onOpenChange };
}

describe('콕 메시지 시트', () => {
  it('메시지를 적어 보내면 요청하고 시트를 닫는다', async () => {
    // Given
    const { httpClient, onOpenChange } = await renderSheet();
    httpClient.post.mockResolvedValue(
      ok({
        message: '콕 찔렀어요',
        remindNudge: {
          id: 1,
          senderId: 'clz7x5p8k0005qz0z8z8z8z8z',
          receiverId: 'clz7x5p8k0001qz0z8z8z8z8z',
          message: '화이팅',
          createdAt: '2026-11-07T00:00:00.000Z',
        },
      }),
    );
    await fireEvent.changeText(
      await screen.findByPlaceholderText('(선택) 작은 할 일 하나부터 같이 시작해보자!'),
      '화이팅',
    );

    // When
    await fireEvent.press(screen.getByText('응원 보내기'));

    // Then
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(httpClient.post).toHaveBeenCalledWith(
      'v1/nudges/remind',
      expect.objectContaining({ receiverId: 'friend-1', message: '화이팅' }),
    );
  });

  it('보내기에 실패하면 시트를 닫지 않고 적은 글을 지킨다', async () => {
    // Given
    const { httpClient, onOpenChange } = await renderSheet();
    httpClient.post.mockResolvedValue(
      err(createAuthApiError({ status: 500, message: '잠시 후 다시' })),
    );
    const input = await screen.findByPlaceholderText('(선택) 작은 할 일 하나부터 같이 시작해보자!');
    await fireEvent.changeText(input, '화이팅');

    // When
    await fireEvent.press(screen.getByText('응원 보내기'));

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByDisplayValue('화이팅')).toBeTruthy();
  });
});
