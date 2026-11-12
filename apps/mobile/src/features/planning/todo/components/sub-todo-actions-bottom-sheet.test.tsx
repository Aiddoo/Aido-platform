import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import {
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { createParentTodo, createSubTodo } from '../__tests__/sub-todo.fixtures';
import { TODO_QUERY_KEYS } from '../queries/todo-query-keys';
import { SubTodoActionsBottomSheet } from './sub-todo-actions-bottom-sheet';

describe('SubTodoActionsBottomSheet', () => {
  it('지우는 동안 라벨이 바뀌고 다시 눌리지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const pendingDelete = createPendingResponse(ok(undefined));
    httpClient.delete.mockReturnValue(pendingDelete.response);
    const todo = createParentTodo({ subTodos: [createSubTodo()] });
    const queryClient = createTestQueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity },
      },
    });
    queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: todo.startDate }), {
      todos: [todo],
      hasNext: false,
      nextCursor: null,
    });

    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ todoId: String(todo.id), subTodoId: '1', date: todo.startDate });

    await renderScreen(
      <LocalDateProvider>
        <OverlayProvider>
          <SubTodoActionsBottomSheet />
        </OverlayProvider>
      </LocalDateProvider>,
      { di: createTestDi({ ports: { httpClient, queryClient } }) },
    );

    // When
    fireEvent.press(screen.getByText('삭제하기')).catch(() => undefined);

    await waitFor(() => {
      expect(screen.getByText('삭제 중...')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByText('삭제 중...')).catch(() => undefined);

    // Then
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    pendingDelete.settle();
  });
});
