import '@src/shared/i18n/init';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { createMockAnalytics, createMockHttpClient } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { RouteSearchParamsProvider } from '@src/shared/providers/route-search-params-provider';
import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

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
  httpClient.patch.mockReturnValue(new Promise(() => undefined));
  httpClient.delete.mockReturnValue(new Promise(() => undefined));

  const todo = createParentTodo({ subTodos: [createSubTodo({ title: '장 보기' })] });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: todo.startDate }), {
    todos: [todo],
    hasNext: false,
    nextCursor: null,
  });

  await renderUi(
    <RouteSearchParamsProvider
      params={{ todoId: String(todo.id), subTodoId: '1', date: todo.startDate }}
    >
      <AddSubTodoBottomSheet mode="edit" />
    </RouteSearchParamsProvider>,
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

  return { httpClient };
}

describe('AddSubTodoBottomSheet 수정 모드', () => {
  it('보내는 동안 전송과 삭제가 모두 잠긴다', async () => {
    const { httpClient } = await renderEditSheet();

    fireEvent.press(submitButton()).catch(() => undefined);

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    expect(deleteButton()).toBeDisabled();
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });

  it('지우는 동안에도 전송이 함께 잠긴다', async () => {
    const { httpClient } = await renderEditSheet();

    fireEvent.press(deleteButton()).catch(() => undefined);

    await waitFor(() => {
      expect(deleteButton()).toBeDisabled();
    });
    expect(submitButton()).toBeDisabled();
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
  });
});
