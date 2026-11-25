/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import { ErrorCode } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import '@src/shared/i18n/init';
import type { DateKey } from '@src/shared/date/date-key';
import {
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
  createApiError,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreenHook } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { createTodoApiError, createTodoDto } from '../__tests__/todo.fixtures';
import type { TodoListResult } from '../domains/todo-list.model';
import type { Todo } from '../domains/todo.model';
import { TODO_QUERY_KEYS } from './todo-query-keys';
import {
  useToggleTodoMutationOptions,
  useUpdateTodoScheduleMutationOptions,
} from './todo.mutations';

const TODAY = createDateKey('2026-10-27');
const TODAY_MONTH_COMPLETIONS = TODO_QUERY_KEYS.completionsByMonth({ month: '2026-10-01' });
const YESTERDAY = createDateKey('2026-10-26');
const ACCOUNT_ID = 'account-1';

setupFakeTimersPerTest({ now: new Date('2026-10-27T03:00:00.000Z'), doNotFake: ['nextTick'] });

async function renderToggle() {
  const httpClient = createHttpClientStub();
  const { result, queryClient } = await renderScreenHook(
    () => useMutation(useToggleTodoMutationOptions()),
    {
      di: createTestDi({ ports: { httpClient } }),
      withLocalDate: true,
    },
  );
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));

  const toggle = async (todoId: number, completed: boolean, date: DateKey) => {
    await act(async () => {
      await result.current
        .mutateAsync({ todoId, body: { completed }, date })
        .catch(() => undefined);
    });
  };
  const startToggle = async (todoId: number, completed: boolean, date: DateKey) => {
    await act(async () => {
      result.current.mutate({ todoId, body: { completed }, date });
    });
  };
  const givenList = (date: DateKey, todos: Todo[]) =>
    queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date }), toList(todos));
  // 관찰자가 없는 조회라 무효화돼도 다시 받지 않고 무효 표시만 남는다
  const givenCached = (queryKey: readonly unknown[]) =>
    queryClient.getQueryCache().build(queryClient, { queryKey });
  const isInvalidated = (queryKey: readonly unknown[]) =>
    queryClient.getQueryState(queryKey)?.isInvalidated === true;

  return {
    httpClient,
    queryClient,
    toggle,
    startToggle,
    givenList,
    givenCached,
    isInvalidated,
  };
}

const toList = (todos: Todo[]): TodoListResult => ({ todos, hasNext: false, nextCursor: null });
const respondWithTodo = (id: number) => ok({ message: 'ok', todo: createTodoDto({ id }) });

describe('useToggleTodoMutationOptions', () => {
  describe('마무리', () => {
    it('다른 체크가 아직 진행 중이면 완료 기록을 다시 부르지 않아 낙관적 값이 깜빡이지 않는다', async () => {
      // Given
      const { httpClient, givenList, givenCached, toggle, startToggle, isInvalidated } =
        await renderToggle();
      givenList(TODAY, [
        createParentTodo({ id: 41, completed: false }),
        createParentTodo({ id: 42, completed: false }),
      ]);
      givenCached(TODAY_MONTH_COMPLETIONS);
      const first = createPendingResponse(respondWithTodo(42));
      httpClient.patch
        .mockReturnValueOnce(first.response)
        .mockResolvedValueOnce(respondWithTodo(41));

      // When
      await startToggle(42, true, TODAY);
      await toggle(41, true, TODAY);

      // Then
      expect(isInvalidated(TODAY_MONTH_COMPLETIONS)).toBe(false);
      await act(async () => first.settle());
    });

    it('하루짜리 체크가 확정되면 목록·달력은 다시 받지 않고 서버만 아는 위젯 요약만 맞춘다', async () => {
      // Given
      const { httpClient, givenList, givenCached, toggle, isInvalidated } = await renderToggle();
      givenList(TODAY, [createParentTodo({ id: 42, startDate: TODAY, completed: false })]);
      givenCached(TODO_QUERY_KEYS.widgetSummaryByDate({ date: TODAY, userId: ACCOUNT_ID }));
      givenCached(TODAY_MONTH_COMPLETIONS);
      httpClient.patch.mockResolvedValue(respondWithTodo(42));

      // When
      await toggle(42, true, TODAY);

      // Then
      expect(
        isInvalidated(TODO_QUERY_KEYS.widgetSummaryByDate({ date: TODAY, userId: ACCOUNT_ID })),
      ).toBe(true);
      expect(isInvalidated(TODO_QUERY_KEYS.listByDate({ date: TODAY }))).toBe(false);
      expect(isInvalidated(TODAY_MONTH_COMPLETIONS)).toBe(false);
    });

    it('체크가 확정되면 서버가 정하는 감사 가능 여부를 다시 받도록 상세를 무효화한다', async () => {
      // Given
      const { httpClient, givenList, givenCached, toggle, isInvalidated } = await renderToggle();
      givenList(TODAY, [createParentTodo({ id: 42, startDate: TODAY, completed: false })]);
      givenCached(TODO_QUERY_KEYS.detail({ todoId: 42 }));
      httpClient.patch.mockResolvedValue(respondWithTodo(42));

      // When
      await toggle(42, true, TODAY);

      // Then
      expect(isInvalidated(TODO_QUERY_KEYS.detail({ todoId: 42 }))).toBe(true);
    });

    it('체크가 실패하면 그 목록과 달력을 서버 값으로 다시 맞춘다', async () => {
      // Given
      const { httpClient, givenList, givenCached, toggle, isInvalidated } = await renderToggle();
      givenList(TODAY, [createParentTodo({ id: 42, startDate: TODAY, completed: false })]);
      givenCached(TODAY_MONTH_COMPLETIONS);
      httpClient.patch.mockResolvedValue(fail(createTodoApiError()));

      // When
      await toggle(42, true, TODAY);

      // Then
      expect(isInvalidated(TODO_QUERY_KEYS.listByDate({ date: TODAY }))).toBe(true);
      expect(isInvalidated(TODAY_MONTH_COMPLETIONS)).toBe(true);
    });

    it('지난 날짜를 체크하면 그 해의 주간 달성 목록을 다시 부른다', async () => {
      // Given
      const { httpClient, givenList, givenCached, toggle, isInvalidated } = await renderToggle();
      givenList(YESTERDAY, [createParentTodo({ id: 42, completed: false })]);
      givenCached(['achievement', 'weekly-list', { year: 2026 }]);
      httpClient.patch.mockResolvedValue(respondWithTodo(42));

      // When
      await toggle(42, true, YESTERDAY);

      // Then
      expect(isInvalidated(['achievement', 'weekly-list', { year: 2026 }])).toBe(true);
    });
  });
});

describe('useUpdateTodoScheduleMutationOptions', () => {
  describe('반복 상한', () => {
    it('이후 회차까지 옮기다 반복 상한에 걸리면 서버가 보낸 한도로 안내한다', async () => {
      // Given
      const httpClient = createHttpClientStub();
      httpClient.patch.mockResolvedValue(
        fail(
          createApiError(ErrorCode.TODO_0842, {
            message: '서버 문구',
            details: {
              limit: 7,
              activeCount: 7,
            },
          }),
        ),
      );
      const { result } = await renderScreenHook(
        () => useMutation(useUpdateTodoScheduleMutationOptions()),
        { di: createTestDi({ ports: { httpClient } }) },
      );

      // When
      await act(async () => {
        await result.current
          .mutateAsync({
            todoId: 1,
            input: { startDate: TODAY },
            scope: 'THIS_AND_FOLLOWING',
          })
          .catch(() => undefined);
      });

      // Then
      expect(
        await screen.findAllByText('반복 할 일은 최대 7개까지 만들 수 있어요'),
      ).not.toHaveLength(0);
    });
  });
});
