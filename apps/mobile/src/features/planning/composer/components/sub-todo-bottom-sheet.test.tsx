import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import {
  createParentTodo,
  createSubTodo,
} from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import '@src/shared/i18n/init';
import type { TodoListResult } from '@src/features/planning/todo/domains/todo.model';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createPendingResponse,
  createSpeechRecognizerStub,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { AddSubTodoBottomSheet } from './add-sub-todo-bottom-sheet';
import { EditSubTodoBottomSheet } from './edit-sub-todo-bottom-sheet';

const submitButton = () => screen.getByTestId('sub-todo-submit');
const deleteButton = () => screen.getByTestId('sub-todo-delete');

async function renderEditSheet() {
  const httpClient = createHttpClientStub();
  const pendingPatch = createPendingResponse(ok(undefined));
  const pendingDelete = createPendingResponse(ok(undefined));
  httpClient.patch.mockReturnValue(pendingPatch.response);
  httpClient.delete.mockReturnValue(pendingDelete.response);

  const todo = createParentTodo({ subTodos: [createSubTodo({ title: '장 보기' })] });
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

  await renderScreen(<EditSubTodoBottomSheet />, {
    withLocalDate: true,
    withOverlay: true,
    di: createTestDi({
      ports: {
        httpClient,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        speechRecognizer: createSpeechRecognizerStub(),
        queryClient,
      },
    }),
  });

  return {
    httpClient,
    settleRequests: () => {
      pendingPatch.settle();
      pendingDelete.settle();
    },
  };
}

describe('EditSubTodoBottomSheet', () => {
  it('보내는 동안 전송과 삭제가 모두 잠긴다', async () => {
    // Given
    const { httpClient, settleRequests } = await renderEditSheet();
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '바뀐 제목');

    // When
    fireEvent.press(submitButton()).catch(() => undefined);

    // Then
    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    expect(deleteButton()).toBeDisabled();
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    settleRequests();
  });

  it('지우는 동안에도 전송이 함께 잠긴다', async () => {
    // Given
    const { httpClient, settleRequests } = await renderEditSheet();

    // When
    fireEvent.press(deleteButton()).catch(() => undefined);

    // Then
    await waitFor(() => {
      expect(deleteButton()).toBeDisabled();
    });
    expect(submitButton()).toBeDisabled();
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    settleRequests();
  });

  it('공백만 남기면 전송이 꺼진다', async () => {
    // Given
    const { settleRequests } = await renderEditSheet();

    // When
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '   ');

    // Then
    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    settleRequests();
  });

  it('제목을 바꾸지 않고 전송하면 요청을 보내지 않는다', async () => {
    // Given
    const { httpClient, settleRequests } = await renderEditSheet();
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '  장 보기  ');

    // When
    await fireEvent.press(submitButton());

    // Then
    expect(httpClient.patch).not.toHaveBeenCalled();
    settleRequests();
  });

  it('고친 제목은 앞뒤 공백을 지우고 보낸다', async () => {
    const { httpClient, settleRequests } = await renderEditSheet();

    // Given
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '  우유 사기  ');

    // When
    fireEvent.press(submitButton()).catch(() => undefined);

    // Then
    await waitFor(() => {
      expect(httpClient.patch).toHaveBeenCalledWith(expect.any(String), { title: '우유 사기' });
    });
    settleRequests();
    await waitFor(() => {
      expect(submitButton()).toBeEnabled();
    });
  });
});

describe('AddSubTodoBottomSheet', () => {
  it('여러 날 할 일에 다른 날짜에서 추가하면 보고 있는 날짜 목록에 바로 들어간다', async () => {
    // Given
    const viewingDate = createDateKey('2026-03-09');
    const httpClient = createHttpClientStub();
    const pendingPost = createPendingResponse(ok(undefined));
    httpClient.post.mockReturnValue(pendingPost.response);
    const todo = createParentTodo({
      startDate: createDateKey('2026-03-08'),
      endDate: createDateKey('2026-03-10'),
    });
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    const listKey = TODO_QUERY_KEYS.listByDate({ date: viewingDate });
    queryClient.setQueryData(listKey, { todos: [todo], hasNext: false, nextCursor: null });
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ todoId: String(todo.id), date: viewingDate });
    await renderScreen(<AddSubTodoBottomSheet />, {
      withLocalDate: true,
      withOverlay: true,
      di: createTestDi({
        ports: {
          httpClient,
          analytics: createAnalyticsStub(),
          errorReporter: createErrorReporterStub(),
          speechRecognizer: createSpeechRecognizerStub(),
          queryClient,
        },
      }),
    });

    // When
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '첫 항목');
    fireEvent.press(submitButton()).catch(() => undefined);

    // Then
    await waitFor(() => {
      expect(queryClient.getQueryData<TodoListResult>(listKey)?.todos[0]?.subTodos).toHaveLength(1);
    });
    pendingPost.settle();
  });

  it('추가에 실패하면 적은 제목을 그대로 두고 다시 보낼 수 있다', async () => {
    // Given
    const viewingDate = createDateKey('2026-03-09');
    const httpClient = createHttpClientStub();
    httpClient.post.mockResolvedValue(
      err(new ApiError('SYS_0001', '잠시 후 다시 시도해주세요', 500)),
    );
    const todo = createParentTodo({ startDate: viewingDate, endDate: viewingDate });
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: viewingDate }), {
      todos: [todo],
      hasNext: false,
      nextCursor: null,
    });
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ todoId: String(todo.id), date: viewingDate });
    await renderScreen(<AddSubTodoBottomSheet />, {
      withLocalDate: true,
      withOverlay: true,
      di: createTestDi({
        ports: {
          httpClient,
          analytics: createAnalyticsStub(),
          errorReporter: createErrorReporterStub(),
          speechRecognizer: createSpeechRecognizerStub(),
          queryClient,
        },
      }),
    });
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '첫 항목');

    // When
    await fireEvent.press(submitButton());

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submitButton()).toBeEnabled());
    expect(screen.getByTestId('sub-todo-input').props.value).toBe('첫 항목');
  });
});
