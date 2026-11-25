import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createParentTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { layoutSheetRoute } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import {
  createHttpClientStub,
  createPendingResponse,
  createSpeechRecognizerStub,
  createTestDi,
  createTestQueryClient,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import SubTodoCreateSheetRoute from '../../../../../app/(app)/todo/[todoId]/sub-todos/new';

const DATE = createDateKey('2026-03-08');

async function renderCreateRoute() {
  const httpClient = createHttpClientStub();
  const pendingPost = createPendingResponse(ok(undefined));
  httpClient.post.mockReturnValue(pendingPost.response);
  const todo = createParentTodo({ id: 7, startDate: DATE });
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: DATE }), {
    todos: [todo],
    hasNext: false,
    nextCursor: null,
  });
  jest.mocked(useLocalSearchParams).mockReturnValue({ todoId: String(todo.id), date: DATE });

  await renderScreen(<SubTodoCreateSheetRoute />, {
    withLocalDate: true,
    di: createTestDi({
      ports: { httpClient, speechRecognizer: createSpeechRecognizerStub(), queryClient },
    }),
  });
  await layoutSheetRoute();
  await screen.findByTestId('sub-todo-input');

  return { httpClient, settle: pendingPost.settle };
}

describe('SubTodoCreateSheetRoute', () => {
  setupFakeTimersPerTest({ now: new Date(2026, 2, 8, 9), advanceTimers: true });

  it('적은 제목을 두 번 보내도 그 할 일에 하위 할 일을 한 번 만든다', async () => {
    // Given
    const { httpClient, settle } = await renderCreateRoute();
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '우유');

    // When
    await userEvent.press(screen.getByTestId('sub-todo-submit'));
    await userEvent.press(screen.getByTestId('sub-todo-submit'));

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(httpClient.post.mock.calls[0]?.[0]).toBe('v1/todos/7/items');
    expect(httpClient.post.mock.calls[0]?.[1]).toMatchObject({ title: '우유' });
    settle();
  });

  it('제목이 비어 있으면 보내기가 꺼지고 요청을 보내지 않는다', async () => {
    // Given
    const { httpClient } = await renderCreateRoute();
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '  ');

    // When
    await userEvent.press(screen.getByTestId('sub-todo-submit'));
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(screen.getByTestId('sub-todo-submit')).toBeDisabled();
    expect(httpClient.post).not.toHaveBeenCalled();
  });
});
