import '@src/shared/i18n/init';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors';
import { createHttpClientStub, createTestDi, createTestQueryClient } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { createParentTodo } from '../../__tests__/sub-todo.fixtures';
import { TODO_QUERY_KEYS } from '../../queries/todo-query-keys';
import { TodoActionsBottomSheet } from './todo-actions-bottom-sheet';

const DIALOG_TITLE = '이 할 일을 모두 삭제할까요?';

async function renderMultiDayTodoActions() {
  const httpClient = createHttpClientStub();
  const removal = Promise.withResolvers<Result<unknown, ApiError>>();
  httpClient.delete.mockReturnValue(removal.promise);
  const todo = createParentTodo({ endDate: createDateKey('2026-03-10') });
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: todo.startDate }), {
    todos: [todo],
    hasNext: false,
    nextCursor: null,
  });
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ todoId: String(todo.id), date: todo.startDate });
  const onClose = jest.fn();
  await renderScreen(<TodoActionsBottomSheet.ActionList summary={() => null} onClose={onClose} />, {
    withLocalDate: true,
    withOverlay: true,
    di: createTestDi({ ports: { httpClient, queryClient } }),
  });
  // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않는다
  const opening = fireEvent.press(screen.getByTestId('todo-action-delete'));
  await screen.findByText(DIALOG_TITLE);
  // 확인 누름은 요청이 끝나야 풀린다. 그리기만 마치고 약속은 쥔다
  let confirmPress: Promise<void> = Promise.resolve();
  await act(async () => {
    confirmPress = fireEvent.press(screen.getByRole('button', { name: '모두 삭제' }));
  });

  return { httpClient, removal, onClose, opening, confirmPress: () => confirmPress };
}

describe('TodoActionsBottomSheet', () => {
  it('여러 날 할 일 삭제가 실패하면 확인 다이얼로그를 남겨 다시 누르거나 취소할 수 있다', async () => {
    // Given
    const { httpClient, removal, onClose, opening, confirmPress } =
      await renderMultiDayTodoActions();
    expect(screen.getByText(DIALOG_TITLE)).toBeOnTheScreen();

    // When
    await act(async () => {
      removal.reject(new NetworkError());
      await confirmPress();
    });

    // Then
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    expect(screen.getByText(DIALOG_TITLE)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '모두 삭제' })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    await opening;
  });

  it('여러 날 할 일을 지우면 다이얼로그가 진행 중으로 남았다가 끝난 뒤 시트를 닫는다', async () => {
    // Given
    const { removal, onClose, opening, confirmPress } = await renderMultiDayTodoActions();

    // When
    await act(async () => {
      removal.resolve(ok({ message: '할 일이 삭제되었습니다.' }));
      await confirmPress();
    });
    await opening;

    // Then
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
