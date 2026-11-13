import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import '@src/shared/i18n/init';
import { err, ok } from '@src/core/errors/result';
import { createHapticsGatewayStub, createHttpClientStub, createTestDi } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
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

  describe('저장 버튼 연타', () => {
    setupFakeTimersPerTest();

    it('저장을 같은 프레임에 두 번 눌러도 할 일은 한 번만 만든다', async () => {
      // Given
      const { httpClient } = await renderSheet();
      httpClient.post.mockResolvedValue(ok({ message: 'converted', todos: [] }));
      const save = await screen.findByLabelText('저장하기');

      // When
      await act(async () => {
        fireEvent.press(save);
        fireEvent.press(save);
      });
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it('옮겨서 시트가 내려가는 동안 저장을 다시 눌러도 할 일은 한 번만 만든다', async () => {
      // Given
      const { httpClient } = await renderSheet();
      httpClient.post.mockResolvedValue(ok({ message: 'converted', todos: [] }));
      const save = await screen.findByLabelText('저장하기');
      await fireEvent.press(save);
      // 연타 가드(600ms)가 지난 뒤다. 시트는 닫힘 애니메이션이 끝나야 내려가 버튼이 아직 보인다
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      // When
      await fireEvent.press(save);
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it('실패한 뒤에는 같은 제목으로 다시 보낼 수 있다', async () => {
      // Given
      const { httpClient } = await renderSheet();
      httpClient.post
        .mockResolvedValueOnce(
          err(new ApiError(ErrorCode.MEMO_2001, '거절', HttpStatus.BAD_REQUEST)),
        )
        .mockResolvedValueOnce(ok({ message: 'converted', todos: [] }));
      const save = await screen.findByLabelText('저장하기');
      await fireEvent.press(save);
      // 연타 가드(600ms)가 지난 뒤의 두 번째 저장이다
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // When
      await fireEvent.press(save);
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.post).toHaveBeenCalledTimes(2);
      expect(httpClient.post.mock.calls[1]?.[1]).toMatchObject({
        todos: [expect.objectContaining({ title: '장보기' })],
      });
    });
  });
});
