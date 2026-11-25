import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import {
  createParentTodo,
  createSubTodo,
} from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { layoutSheetRoute } from '@src/features/planning/todo/__tests__/todo.test-utils';
import type { TodoListResult } from '@src/features/planning/todo/domains/todo-list.model';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import {
  createHttpClientStub,
  createPendingResponse,
  createSpeechRecognizerStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import SubTodoEditSheetRoute from '../../../../../app/(app)/todo/[todoId]/sub-todos/[subTodoId]/edit';

const DATE = createDateKey('2026-03-08');
const LIST_KEY = TODO_QUERY_KEYS.listByDate({ date: DATE });

async function renderEditRoute() {
  const httpClient = createHttpClientStub();
  const pendingPatch = createPendingResponse(ok(undefined));
  const pendingDelete = createPendingResponse(ok(undefined));
  httpClient.patch.mockReturnValue(pendingPatch.response);
  httpClient.delete.mockReturnValue(pendingDelete.response);
  const todo = createParentTodo({
    id: 7,
    startDate: DATE,
    subTodos: [
      createSubTodo({ id: 3, title: '장 보기' }),
      createSubTodo({ id: 4, title: '요리', sortOrder: 1 }),
    ],
  });
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(LIST_KEY, { todos: [todo], hasNext: false, nextCursor: null });
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ todoId: String(todo.id), subTodoId: '3', date: DATE });
  const speechRecognizer = createSpeechRecognizerStub();

  await renderScreen(<SubTodoEditSheetRoute />, {
    withLocalDate: true,
    di: createTestDi({ ports: { httpClient, speechRecognizer, queryClient } }),
  });
  await layoutSheetRoute();
  await screen.findByDisplayValue('장 보기');

  return {
    httpClient,
    readSubTodoTitles: () =>
      queryClient
        .getQueryData<TodoListResult>(LIST_KEY)
        ?.todos[0]?.subTodos.map(({ title }) => title),
    dictate: async (transcript: string) => {
      await fireEvent.press(screen.getByLabelText('말로 입력'));
      await act(async () =>
        speechRecognizer.emit({ type: 'result', transcript, isFinal: true, segments: [] }),
      );
    },
    settleRequests: () => {
      pendingPatch.settle();
      pendingDelete.settle();
    },
  };
}

describe('SubTodoEditSheetRoute', () => {
  it('제목을 고쳐 보내면 그 항목의 새 제목을 보내고 목록에 바로 바뀐다', async () => {
    // Given
    const { httpClient, readSubTodoTitles, settleRequests } = await renderEditRoute();
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '장 보고 오기');

    // When
    await userEvent.press(screen.getByTestId('sub-todo-submit'));

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    expect(httpClient.patch.mock.calls[0]?.[0]).toBe('v1/todos/7/items/3');
    expect(httpClient.patch.mock.calls[0]?.[1]).toMatchObject({ title: '장 보고 오기' });
    expect(readSubTodoTitles()).toEqual(['장 보고 오기', '요리']);
    settleRequests();
  });

  it('지우면 그 항목을 지우는 요청을 보내고 목록에서 바로 빠진다', async () => {
    // Given
    const { httpClient, readSubTodoTitles, settleRequests } = await renderEditRoute();

    // When
    await userEvent.press(screen.getByTestId('sub-todo-delete'));

    // Then
    await waitFor(() => expect(httpClient.delete).toHaveBeenCalledTimes(1));
    expect(httpClient.delete.mock.calls[0]?.[0]).toBe('v1/todos/7/items/3');
    expect(readSubTodoTitles()).toEqual(['요리']);
    settleRequests();
  });

  it('받아쓴 제목이 한도를 넘으면 한도에서 자르고, 한도에 걸친 이모지는 반으로 잘린 글자가 남는다', async () => {
    // Given
    const { dictate } = await renderEditRoute();
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '');

    // When
    await dictate(`${'가'.repeat(199)}😀`);

    // Then
    expect(screen.getByTestId('sub-todo-input').props.value).toBe(`${'가'.repeat(199)}\ud83d`);
  });
});
