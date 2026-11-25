import { ErrorCode, HttpStatus } from '@aido/api/errors';
import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { readLocalDateState } from '@src/shared/date/clock';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import {
  createHapticsGatewayStub,
  createHttpClientStub,
  createTestDi,
  createApiError,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';

import { MemoConvertBottomSheet } from './memo-convert-bottom-sheet';

const MEMO = { id: 5, content: '장보기' };

async function renderSheet() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createTodoCategoryListDto()));
  const onClose = jest.fn();
  const onConverted = jest.fn();
  const onUnavailable = jest.fn();
  await renderScreen(
    <MemoConvertBottomSheet
      memo={MEMO}
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
    await fireEvent(await screen.findByDisplayValue('장보기'), 'submitEditing');
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

  describe('완료 키', () => {
    it('제목을 비우고 완료 키를 누르면 보내지 않고 시트를 닫는다', async () => {
      // Given
      const { httpClient, onClose } = await renderSheet();
      await fireEvent.changeText(await screen.findByDisplayValue('장보기'), '   ');

      // When
      await act(async () => {
        await fireEvent(screen.getByDisplayValue('   '), 'submitEditing');
      });

      // Then
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it('제목을 비웠다가 다시 쓰고 완료 키를 누르면 저장 버튼과 같이 보낸다', async () => {
      // Given
      const { httpClient, onClose, onConverted } = await renderSheet();
      httpClient.post.mockResolvedValue(ok({ message: 'converted', todos: [] }));
      const input = await screen.findByDisplayValue('장보기');
      await fireEvent.changeText(input, '');
      await waitFor(() => expect(screen.getByLabelText('저장하기')).toBeDisabled());
      await fireEvent.changeText(input, '우유 사기');
      await waitFor(() => expect(screen.getByLabelText('저장하기')).toBeEnabled());

      // When
      await act(async () => {
        await fireEvent(input, 'submitEditing');
      });

      // Then
      await waitFor(() => expect(onConverted).toHaveBeenCalledTimes(1));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(httpClient.post).toHaveBeenCalledTimes(1);
      expect(httpClient.post.mock.calls[0]?.[1]).toMatchObject({
        todos: [expect.objectContaining({ title: '우유 사기' })],
      });
    });

    it('칩으로 날짜를 바꾼 뒤 완료 키를 누르면 저장 버튼과 같은 판정으로 바꾼 날짜를 보낸다', async () => {
      // Given
      const { httpClient, onConverted } = await renderSheet();
      httpClient.post.mockResolvedValue(ok({ message: 'converted', todos: [] }));
      const tomorrow = addDaysToDateKey(readLocalDateState().currentLocalDateKey, 1);
      await screen.findByText('기본');
      await userEvent.press(screen.getByRole('button', { name: '오늘' }));
      await userEvent.press(await screen.findByText('내일'));
      await waitFor(() => expect(screen.getByLabelText('저장하기')).toBeEnabled());

      // When
      await submit();

      // Then
      await waitFor(() => expect(onConverted).toHaveBeenCalledTimes(1));
      expect(httpClient.post).toHaveBeenCalledTimes(1);
      expect(httpClient.post.mock.calls[0]?.[1]).toMatchObject({
        todos: [expect.objectContaining({ title: '장보기', startDate: tomorrow })],
      });
    });
  });

  it('서버가 거절하면 시트와 입력값을 그대로 남긴다', async () => {
    // Given
    const { httpClient, onClose, onConverted } = await renderSheet();
    httpClient.post.mockResolvedValue(
      fail(
        createApiError(ErrorCode.MEMO_2004, { message: '거절', status: HttpStatus.BAD_REQUEST }),
      ),
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
      fail(createApiError(ErrorCode.MEMO_2001, { message: '메모 없음' })),
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
      httpClient.get.mockResolvedValue(ok(createTodoCategoryListDto()));
      httpClient.post.mockResolvedValue(ok({ message: 'converted', todos: [] }));
      const sheetFor = (memo: { id: number; content: string }) => (
        <MemoConvertBottomSheet
          memo={memo}
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
        await fireEvent.press(save);
        await fireEvent.press(save);
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
          fail(
            createApiError(ErrorCode.MEMO_2004, {
              message: '거절',
              status: HttpStatus.BAD_REQUEST,
            }),
          ),
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
