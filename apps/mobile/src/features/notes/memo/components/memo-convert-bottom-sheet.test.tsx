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
  const onUnavailable = jest.fn();
  await renderScreen(
    <MemoConvertBottomSheet
      memo={MEMO}
      selectedDate={createDateKey('2026-11-07')}
      categoryId={1}
      isOpen
      onOpenChange={jest.fn()}
      onClose={onClose}
      onConverted={onConverted}
      onUnavailable={onUnavailable}
    />,
    {
      di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
      withLocalDate: true,
      withOverlay: true,
    },
  );

  return { httpClient, onClose, onConverted, onUnavailable };
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
      err(new ApiError(ErrorCode.MEMO_2004, '거절', HttpStatus.BAD_REQUEST)),
    );

    // When
    await submit();

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(onConverted).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('장보기')).toBeTruthy();
  });

  it('이미 없는 메모라 거절하면 다시 보내라 하지 않고 시트를 닫아 메모를 떠난다', async () => {
    // Given
    // 다른 기기에서 지웠거나 이미 할 일로 바꾼 메모
    const { httpClient, onClose, onConverted, onUnavailable } = await renderSheet();
    httpClient.post.mockResolvedValue(
      err(new ApiError(ErrorCode.MEMO_2001, '메모 없음', HttpStatus.NOT_FOUND)),
    );

    // When
    await submit();

    // Then
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConverted).not.toHaveBeenCalled();
    expect(await screen.findAllByText('이미 없는 메모예요')).not.toHaveLength(0);
    // 다시 보내라는 일반 실패 안내는 띄우지 않는다
    expect(screen.queryByText('메모를 찾을 수 없어요')).toBeNull();
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  describe('다른 메모로 다시 쓰기', () => {
    setupFakeTimersPerTest();

    it('메모 하나를 옮긴 뒤 같은 시트가 다른 메모를 받으면 그 메모 글로 새로 시작해 한 번 보낸다', async () => {
      // Given
      const httpClient = createHttpClientStub();
      httpClient.get.mockResolvedValue(ok({ categories: [] }));
      httpClient.post.mockResolvedValue(ok({ message: 'converted', todos: [] }));
      const sheetFor = (memo: { id: number; content: string }) => (
        <MemoConvertBottomSheet
          memo={memo}
          selectedDate={createDateKey('2026-11-07')}
          categoryId={1}
          isOpen
          onOpenChange={jest.fn()}
          onClose={jest.fn()}
          onConverted={jest.fn()}
          onUnavailable={jest.fn()}
        />
      );
      const { rerender } = await renderScreen(sheetFor(MEMO), {
        di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub() } }),
        withLocalDate: true,
        withOverlay: true,
      });
      await fireEvent.press(await screen.findByLabelText('저장하기'));
      // 연타 가드(600ms)가 지난 뒤다
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // When
      await rerender(sheetFor({ id: 6, content: '빨래하기' }));
      await fireEvent.press(await screen.findByLabelText('저장하기'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(screen.getByDisplayValue('빨래하기')).toBeTruthy();
      expect(httpClient.post.mock.calls.map(([url]) => url)).toEqual([
        'v1/memos/5/convert-to-todos',
        'v1/memos/6/convert-to-todos',
      ]);
      expect(httpClient.post.mock.calls[1]?.[1]).toMatchObject({
        todos: [expect.objectContaining({ title: '빨래하기' })],
      });
    });
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
          err(new ApiError(ErrorCode.MEMO_2004, '거절', HttpStatus.BAD_REQUEST)),
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
