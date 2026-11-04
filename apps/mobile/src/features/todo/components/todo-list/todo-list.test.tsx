import '@src/shared/i18n/init';
import { createActivationProgressRepository } from '@src/features/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/activation/apis/activation.service';
import { PreferenceService } from '@src/features/preference/apis/preference.service';
import { PREFERENCE_QUERY_KEYS } from '@src/features/preference/constants/preference-query-keys';
import { createStoreReviewRepository } from '@src/features/store-review/apis/store-review.repository';
import { StoreReviewService } from '@src/features/store-review/apis/store-review.service';
import {
  createErrorReporterStub,
  createMockAnalytics,
  createMockHttpClient,
  createMemorySyncStorage,
  createPendingResponse,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ok } from '@src/shared/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Suspense } from 'react';
import { Text } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';

import { createParentTodo, createSubTodo } from '../../__tests__/sub-todo.factories';
import { SubTodoService } from '../../apis/sub-todo.service';
import { TodoCategoryService } from '../../apis/todo-category.service';
import { TodoService } from '../../apis/todo.service';
import { TODO_CATEGORY_QUERY_KEYS } from '../../constants/todo-category-query-keys';
import { TODO_QUERY_KEYS } from '../../constants/todo-query-keys';
import type { Todo } from '../../domains/todo.model';
import { updateCachedTodo } from '../../queries/todo-cache';
import { FeedDateProvider } from '../providers/feed-date-provider';
import { TodoList } from './todo-list';

const DATE = '2026-03-08';

async function renderTodoList(todo: Todo) {
  const httpClient = createMockHttpClient();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: DATE }), {
    todos: [todo],
    hasNext: false,
    nextCursor: null,
  });
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [{ ...todo.category, sortOrder: 0, todoCount: 1 }],
  });
  queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), { timeFormat: 'H12' });

  await renderUi(
    <LocalDateProvider>
      <FeedDateProvider date={DATE} onDateChange={() => undefined}>
        <ScrollViewContainer>
          <Suspense fallback={<Text>loading</Text>}>
            <TodoList />
          </Suspense>
        </ScrollViewContainer>
      </FeedDateProvider>
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        analytics: createMockAnalytics(),
        errorReporter: createErrorReporterStub(),
        logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        preferenceService: new PreferenceService(httpClient),
        activationService: new ActivationService(
          createActivationProgressRepository(createMemorySyncStorage()),
        ),
        storeReviewService: new StoreReviewService(
          createStoreReviewRepository(createMemorySyncStorage()),
          { isAvailable: async () => false, requestReview: async () => undefined },
        ),
        subTodoService: new SubTodoService(httpClient),
        todoService: new TodoService(httpClient),
        todoCategoryService: new TodoCategoryService(httpClient),
      },
    },
  );

  return { httpClient, queryClient };
}

describe('TodoList 낙관적 표시', () => {
  it('첫 하위 항목을 낙관적으로 더하면 막대와 함께 행도 바로 보인다', async () => {
    // Given
    const { queryClient } = await renderTodoList(createParentTodo({ startDate: DATE }));
    await fireEvent.press(screen.getByText('테스트 할일'));

    // When
    await act(async () => {
      updateCachedTodo(queryClient, { date: DATE, todoId: 1 }, (todo) => ({
        ...todo,
        subTodos: [createSubTodo({ id: -1, title: '첫 항목' })],
        subTodoStats: { total: 1, completed: 0 },
      }));
    });

    // Then
    expect(await screen.findByText('첫 항목')).toBeOnTheScreen();
  });

  it('임시 하위 항목은 응답 전까지 체크를 막아 임시 id로 요청을 보내지 않는다', async () => {
    // Given
    await renderTodoList(
      createParentTodo({
        startDate: DATE,
        subTodos: [createSubTodo({ id: -1, title: '첫 항목' })],
        subTodoStats: { total: 1, completed: 0 },
      }),
    );

    // Then
    expect(screen.getByTestId('sub-todo-checkbox--1')).toBeDisabled();
  });

  it('다시 받은 목록의 서버 id가 행에 바로 쓰여 임시 id로 요청을 보내지 않는다', async () => {
    // Given
    const { queryClient } = await renderTodoList(
      createParentTodo({
        startDate: DATE,
        subTodos: [createSubTodo({ id: -1, title: '첫 항목' })],
        subTodoStats: { total: 1, completed: 0 },
      }),
    );

    // When
    await act(async () => {
      queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: DATE }), {
        todos: [
          createParentTodo({
            startDate: DATE,
            subTodos: [createSubTodo({ id: 77, title: '첫 항목' })],
            subTodoStats: { total: 1, completed: 0 },
          }),
        ],
        hasNext: false,
        nextCursor: null,
      });
    });

    // Then
    expect(await screen.findByTestId('sub-todo-checkbox-77')).toBeOnTheScreen();
  });

  it('하위 항목 체크는 서버 응답 전에 행에 바로 반영된다', async () => {
    // Given
    const pending = createPendingResponse(ok({ todo: {} }));
    const { httpClient } = await renderTodoList(
      createParentTodo({
        startDate: DATE,
        subTodos: [createSubTodo({ id: 5, title: '기존 항목' })],
        subTodoStats: { total: 1, completed: 0 },
      }),
    );
    httpClient.patch.mockReturnValue(pending.response);

    // When
    await fireEvent.press(screen.getByTestId('sub-todo-checkbox-5'));

    // Then
    await waitFor(() => {
      expect(screen.getByTestId('sub-todo-checkbox-5')).toBeChecked();
    });
    pending.settle();
  });
});
