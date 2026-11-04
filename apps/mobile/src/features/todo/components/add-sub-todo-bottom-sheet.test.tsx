import '@src/shared/i18n/init';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import {
  createMockAnalytics,
  createMockHttpClient,
  createPendingResponse,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { createParentTodo, createSubTodo } from '../__tests__/sub-todo.factories';
import { SubTodoService } from '../apis/sub-todo.service';
import { TodoService } from '../apis/todo.service';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { AddSubTodoBottomSheet } from './add-sub-todo-bottom-sheet';

const submitButton = () => screen.getByTestId('sub-todo-submit');
const deleteButton = () => screen.getByTestId('sub-todo-delete');

function createMockErrorReporter(): jest.Mocked<ErrorReporter> {
  return {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUserId: jest.fn(),
  };
}

async function renderEditSheet() {
  const httpClient = createMockHttpClient();
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

  await renderUi(
    <LocalDateProvider>
      <AddSubTodoBottomSheet mode="edit" />
    </LocalDateProvider>,
    {
      di: {
        subTodoService: new SubTodoService(httpClient),
        todoService: new TodoService(httpClient),
        analytics: createMockAnalytics(),
        errorReporter: createMockErrorReporter(),
      },
      queryClient,
    },
  );

  return {
    httpClient,
    settleRequests: () => {
      pendingPatch.settle();
      pendingDelete.settle();
    },
  };
}

describe('AddSubTodoBottomSheet 수정 모드', () => {
  it('보내는 동안 전송과 삭제가 모두 잠긴다', async () => {
    const { httpClient, settleRequests } = await renderEditSheet();

    fireEvent.press(submitButton()).catch(() => undefined);

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    expect(deleteButton()).toBeDisabled();
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    settleRequests();
  });

  it('지우는 동안에도 전송이 함께 잠긴다', async () => {
    const { httpClient, settleRequests } = await renderEditSheet();

    fireEvent.press(deleteButton()).catch(() => undefined);

    await waitFor(() => {
      expect(deleteButton()).toBeDisabled();
    });
    expect(submitButton()).toBeDisabled();
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    settleRequests();
  });

  it('공백만 남기면 전송이 꺼진다', async () => {
    const { settleRequests } = await renderEditSheet();

    // Given 제목을 공백으로 바꾼다
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '   ');

    // Then 전송 버튼이 꺼진다
    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    settleRequests();
  });

  it('고친 제목은 앞뒤 공백을 지우고 보낸다', async () => {
    const { httpClient, settleRequests } = await renderEditSheet();

    // Given 제목을 앞뒤 공백과 함께 고친다
    await fireEvent.changeText(screen.getByTestId('sub-todo-input'), '  우유 사기  ');

    // When 전송한다
    fireEvent.press(submitButton()).catch(() => undefined);

    // Then 공백을 지운 제목으로 수정을 요청한다
    await waitFor(() => {
      expect(httpClient.patch).toHaveBeenCalledWith(expect.any(String), { title: '우유 사기' });
    });
    settleRequests();
    await waitFor(() => {
      expect(submitButton()).toBeEnabled();
    });
  });
});
