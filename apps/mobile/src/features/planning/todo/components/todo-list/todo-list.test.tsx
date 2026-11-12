import { ok } from '@src/core/errors/result';
import { createPreference } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import '@src/shared/i18n/init';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/queries/todo-category-query-keys';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import {
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { Text } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';

import { createParentTodo, createSubTodo } from '../../__tests__/sub-todo.fixtures';
import type { Todo } from '../../domains/todo.model';
import { updateCachedTodo } from '../../queries/todo-cache';
import { TODO_QUERY_KEYS } from '../../queries/todo-query-keys';
import { TodoList } from './todo-list';

const DATE = createDateKey('2026-03-08');

async function renderTodoList(todo: Todo) {
  const httpClient = createHttpClientStub();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  jest.mocked(useLocalSearchParams).mockReturnValue({ date: DATE });
  queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: DATE }), {
    todos: [todo],
    hasNext: false,
    nextCursor: null,
  });
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [{ ...todo.category, sortOrder: 0, todoCount: 1 }],
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    createPreference({ timeFormat: 'TWELVE_HOUR' }),
  );

  await renderScreen(
    <LocalDateProvider>
      <ScrollViewContainer>
        <Suspense fallback={<Text>loading</Text>}>
          <TodoList />
        </Suspense>
      </ScrollViewContainer>
    </LocalDateProvider>,
    { di: createTestDi({ ports: { httpClient, queryClient } }) },
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
      }));
    });

    // Then
    expect(await screen.findByText('첫 항목')).toBeOnTheScreen();
  });

  it('임시 하위 항목은 응답 전까지 체크를 막아 임시 id로 요청을 보내지 않는다', async () => {
    // When
    await renderTodoList(
      createParentTodo({
        startDate: DATE,
        subTodos: [createSubTodo({ id: -1, title: '첫 항목' })],
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
      }),
    );

    // When
    await act(async () => {
      queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: DATE }), {
        todos: [
          createParentTodo({
            startDate: DATE,
            subTodos: [createSubTodo({ id: 77, title: '첫 항목' })],
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
