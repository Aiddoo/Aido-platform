import '@src/shared/i18n/init';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { createMockAnalytics, createMockHttpClient } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { RouteSearchParamsProvider } from '@src/shared/providers/route-search-params-provider';
import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createParentTodo, createSubTodo } from '../../__tests__/sub-todo.factories';
import { SubTodoService } from '../../apis/sub-todo.service';
import { TodoService } from '../../apis/todo.service';
import { TODO_QUERY_KEYS } from '../../constants/todo-query-keys';
import { SubTodoActionsBottomSheet } from './sub-todo-actions-bottom-sheet';

function createMockErrorReporter(): jest.Mocked<ErrorReporter> {
  return {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUserId: jest.fn(),
  };
}

describe('SubTodoActionsBottomSheet', () => {
  it('지우는 동안 라벨이 바뀌고 다시 눌리지 않는다', async () => {
    const httpClient = createMockHttpClient();
    httpClient.delete.mockReturnValue(new Promise(() => undefined));
    const todo = createParentTodo({ subTodos: [createSubTodo()] });
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
        <SubTodoActionsBottomSheet />
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

    fireEvent.press(screen.getByText('삭제하기')).catch(() => undefined);

    await waitFor(() => {
      expect(screen.getByText('삭제 중...')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByText('삭제 중...')).catch(() => undefined);
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
  });
});
