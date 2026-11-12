import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import '@src/shared/i18n/init';
import { err, ok } from '@src/core/errors/result';
import { createHapticsGatewayStub, createHttpClientStub, createTestDi } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { MemoConvertBottomSheet } from './memo-convert-bottom-sheet';

const MEMO = { id: 5, content: '장보기' };

async function renderSheet() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok({ categories: [] }));
  const onClose = jest.fn();
  const onConverted = jest.fn();
  await renderScreen(
    <MemoConvertBottomSheet
      memo={MEMO}
      selectedDate={createDateKey('2026-11-07')}
      categoryId={1}
      isOpen
      onOpenChange={jest.fn()}
      onClose={onClose}
      onConverted={onConverted}
    />,
    {
      di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
      withLocalDate: true,
      withOverlay: true,
    },
  );

  return { httpClient, onClose, onConverted };
}

async function submit() {
  await act(async () => {
    fireEvent(await screen.findByDisplayValue('장보기'), 'submitEditing');
  });
}

describe('MemoConvertBottomSheet', () => {
  it('메모 내용을 제목으로 채워 변환하고 시트를 닫는다', async () => {
    // Given
    const { httpClient, onClose, onConverted } = await renderSheet();
    httpClient.post.mockResolvedValue(ok({ message: 'converted', todos: [] }));

    // When
    await submit();

    // Then
    await waitFor(() => expect(onConverted).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith(
      'v1/memos/5/convert-to-todos',
      expect.objectContaining({
        todos: [expect.objectContaining({ title: '장보기', categoryId: 1 })],
      }),
    );
  });

  it('서버가 거절하면 시트와 입력값을 그대로 남긴다', async () => {
    // Given
    const { httpClient, onClose, onConverted } = await renderSheet();
    httpClient.post.mockResolvedValue(
      err(new ApiError(ErrorCode.MEMO_2001, '거절', HttpStatus.BAD_REQUEST)),
    );

    // When
    await submit();

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(onConverted).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('장보기')).toBeTruthy();
  });
});
