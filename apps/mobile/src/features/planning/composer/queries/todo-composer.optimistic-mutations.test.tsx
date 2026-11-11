import { err, ok } from '@src/core/errors/result';
import '@src/shared/i18n/init';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/constants/todo-category-query-keys';
import {
  createParentTodo,
  createSubTodo,
} from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import {
  createTodoApiError,
  createTodoDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/constants/todo-query-keys';
import type { DailyCompletionsResult } from '@src/features/planning/todo/domains/daily-completion.model';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import type {
  Todo,
  TodoDetails,
  TodoListResult,
} from '@src/features/planning/todo/domains/todo.model';
import { useDeleteSubTodoMutationOptions } from '@src/features/planning/todo/queries/sub-todo.mutations';
import { useReorderSubTodosMutationOptions } from '@src/features/planning/todo/queries/sub-todo.mutations';
import { useToggleSubTodoMutationOptions } from '@src/features/planning/todo/queries/sub-todo.mutations';
import { useDeleteTodoMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import { useToggleTodoMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import {
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { useMutation } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';

import { useAddSubTodoMutationOptions } from './todo-composer.mutations';
import { useCreateTodoMutationOptions } from './todo-composer.mutations';
import { useUpdateSubTodoMutationOptions } from './todo-composer.mutations';

const DAY_1 = '2026-03-08';
const DAY_2 = '2026-03-09';
const DAY_3 = '2026-03-10';
const WEEK = { startDate: '2026-03-08', endDate: '2026-03-14' };
const LIST_DAY_1 = TODO_QUERY_KEYS.listByDate({ date: DAY_1 });
const LIST_DAY_2 = TODO_QUERY_KEYS.listByDate({ date: DAY_2 });
const LIST_DAY_3 = TODO_QUERY_KEYS.listByDate({ date: DAY_3 });
const WEEK_COMPLETIONS = TODO_QUERY_KEYS.completionsByRange(WEEK);
const RED = '#FF0000';
const CATEGORY = { id: 1, name: '기본', color: RED };

const respondWith = (overrides: Parameters<typeof createTodoDto>[0]) =>
  createPendingResponse(ok({ message: 'ok', todo: createTodoDto(overrides) }));
const toList = (todos: Todo[]): TodoListResult => ({ todos, hasNext: false, nextCursor: null });
const createCompletions = (totalTodos: number, completedTodos: number): DailyCompletionsResult => ({
  completions: [
    {
      date: DAY_1,
      totalTodos,
      completedTodos,
      isComplete: totalTodos > 0 && totalTodos === completedTodos,
      completionRate: totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0,
      categoryColors: [RED],
    },
  ],
  totalCompleteDays: totalTodos > 0 && totalTodos === completedTodos ? 1 : 0,
  dateRange: WEEK,
});

async function renderMutations() {
  const httpClient = createHttpClientStub();
  const queryClient = createTestQueryClient();
  const current: { value: ReturnType<typeof useTodoMutations> | null } = { value: null };

  function Probe({
    onRender,
  }: {
    onRender: (mutations: ReturnType<typeof useTodoMutations>) => void;
  }) {
    onRender(useTodoMutations());
    return null;
  }

  await renderUi(
    <LocalDateProvider>
      <Probe
        onRender={(mutations) => {
          current.value = mutations;
        }}
      />
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        httpClient,
      },
    },
  );

  const mutations = () => {
    if (current.value == null) {
      throw new Error('Probe가 렌더되지 않았다');
    }
    return current.value;
  };
  const cachedTodo = (key: readonly unknown[], todoId = 1) =>
    queryClient.getQueryData<TodoListResult>(key)?.todos.find((todo) => todo.id === todoId);
  const isInvalidated = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated === true;

  return { httpClient, queryClient, mutations, cachedTodo, isInvalidated };
}

function useTodoMutations() {
  return {
    addSubTodo: useMutation(useAddSubTodoMutationOptions()),
    updateSubTodo: useMutation(useUpdateSubTodoMutationOptions()),
    deleteSubTodo: useMutation(useDeleteSubTodoMutationOptions()),
    toggleSubTodo: useMutation(useToggleSubTodoMutationOptions()),
    reorderSubTodos: useMutation(useReorderSubTodosMutationOptions()),
    toggleTodo: useMutation(useToggleTodoMutationOptions()),
    createTodo: useMutation(useCreateTodoMutationOptions()),
    deleteTodo: useMutation(useDeleteTodoMutationOptions()),
  };
}

const flush = () => act(async () => {});
/** 행과 상세의 진행 막대가 읽는 값 */
const progress = (todo: Todo | undefined) => todo && SubTodoPolicy.getSubTodoStats(todo.subTodos);

describe('하위 할 일 낙관적 갱신', () => {
  it('여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록에 첫 항목이 바로 들어간다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    const multiDay = createParentTodo({ startDate: DAY_1, endDate: DAY_3 });
    queryClient.setQueryData(LIST_DAY_2, toList([multiDay]));
    const response = respondWith({ id: 1 });
    httpClient.post.mockReturnValue(response.response);

    // When
    await act(async () => {
      mutations().addSubTodo.mutate({ todoId: 1, title: '첫 항목', date: DAY_2 });
    });

    // Then
    expect(progress(cachedTodo(LIST_DAY_2))).toEqual({ total: 1, completed: 0 });
    response.settle();
    await flush();
  });

  it('완료한 할 일에 항목을 더하면 바로 미완료가 되고 달력도 함께 맞는다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([createParentTodo({ startDate: DAY_1, completed: true })]),
    );
    queryClient.setQueryData(WEEK_COMPLETIONS, createCompletions(1, 1));
    const response = respondWith({ id: 1 });
    httpClient.post.mockReturnValue(response.response);

    // When
    await act(async () => {
      mutations().addSubTodo.mutate({ todoId: 1, title: '새 항목', date: DAY_1 });
    });

    // Then
    expect(cachedTodo(LIST_DAY_1)?.completed).toBe(false);
    expect(progress(cachedTodo(LIST_DAY_1))).toEqual({ total: 1, completed: 0 });
    expect(
      queryClient.getQueryData<DailyCompletionsResult>(WEEK_COMPLETIONS)?.completions[0],
    ).toEqual(expect.objectContaining({ completedTodos: 0, isComplete: false }));
    response.settle();
    await flush();
  });

  it('완료한 할 일에 더하기가 실패하면 완료로 되돌아간다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([createParentTodo({ startDate: DAY_1, completed: true })]),
    );
    httpClient.post.mockRejectedValue(new Error('network'));

    // When
    await act(async () => {
      await mutations()
        .addSubTodo.mutateAsync({ todoId: 1, title: '새 항목', date: DAY_1 })
        .catch(() => undefined);
    });

    // Then
    expect(cachedTodo(LIST_DAY_1)?.completed).toBe(true);
    expect(progress(cachedTodo(LIST_DAY_1))).toEqual({ total: 0, completed: 0 });
  });

  it('응답이 오면 임시 id를 서버 id로 바꿔 다시 받기 전에도 행을 누를 수 있다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    queryClient.setQueryData(LIST_DAY_1, toList([createParentTodo({ startDate: DAY_1 })]));
    httpClient.post.mockResolvedValue(
      ok({
        message: 'ok',
        todo: createTodoDto({
          id: 1,
          items: [
            {
              id: 77,
              title: '첫 항목',
              completed: false,
              sortOrder: 0,
              createdAt: '2026-03-08T00:00:00.000Z',
              updatedAt: '2026-03-08T00:00:00.000Z',
            },
          ],
          itemStats: { total: 1, completed: 0 },
        }),
      }),
    );

    // When
    await act(async () => {
      await mutations().addSubTodo.mutateAsync({ todoId: 1, title: '첫 항목', date: DAY_1 });
    });

    // Then
    expect(cachedTodo(LIST_DAY_1)?.subTodos.map((subTodo) => subTodo.id)).toEqual([77]);
  });

  it('추가가 실패하면 그 임시 항목만 빠지고 함께 체크한 다른 항목은 유지된다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([
        createParentTodo({
          startDate: DAY_1,
          subTodos: [createSubTodo({ id: 5 })],
        }),
      ]),
    );
    const failedAdd = createPendingResponse(err(createTodoApiError()));
    const pendingToggle = respondWith({ id: 1 });
    httpClient.post.mockReturnValue(failedAdd.response);
    httpClient.patch.mockReturnValue(pendingToggle.response);
    await act(async () => {
      mutations().addSubTodo.mutate({ todoId: 1, title: '실패할 항목', date: DAY_1 });
    });
    await act(async () => {
      mutations().toggleSubTodo.mutate({
        todoId: 1,
        subTodoId: 5,
        isCompleted: true,
        date: DAY_1,
      });
    });

    // When
    failedAdd.settle();
    await flush();

    // Then
    expect(cachedTodo(LIST_DAY_1)?.subTodos).toEqual([
      expect.objectContaining({ id: 5, completed: true }),
    ]);
    expect(progress(cachedTodo(LIST_DAY_1))).toEqual({ total: 1, completed: 1 });
    pendingToggle.settle();
    await flush();
  });

  it('연달아 체크하면 앞 응답으로 다시 받지 않아 뒤 체크가 되돌아가지 않고 마지막에 한 번 맞춘다', async () => {
    // Given
    const { httpClient, queryClient, mutations, isInvalidated, cachedTodo } =
      await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([
        createParentTodo({
          startDate: DAY_1,
          subTodos: [createSubTodo({ id: 5 }), createSubTodo({ id: 6 })],
        }),
      ]),
    );
    const first = respondWith({ id: 1 });
    const second = respondWith({ id: 1 });
    httpClient.patch.mockReturnValueOnce(first.response).mockReturnValueOnce(second.response);
    await act(async () => {
      mutations().toggleSubTodo.mutate({ todoId: 1, subTodoId: 5, isCompleted: true, date: DAY_1 });
    });
    await act(async () => {
      mutations().toggleSubTodo.mutate({ todoId: 1, subTodoId: 6, isCompleted: true, date: DAY_1 });
    });

    // When
    first.settle();
    await flush();

    // Then
    expect(progress(cachedTodo(LIST_DAY_1))).toEqual({ total: 2, completed: 2 });
    expect(httpClient.get).not.toHaveBeenCalled();

    // When
    second.settle();
    await flush();

    // Then
    expect(isInvalidated(LIST_DAY_1)).toBe(true);
  });

  it('할 일 체크가 진행 중이면 하위 항목 응답으로 목록을 다시 받지 않고, 체크가 끝날 때 달력까지 맞춘다', async () => {
    // Given
    const { httpClient, queryClient, mutations, isInvalidated, cachedTodo } =
      await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([
        createParentTodo({
          startDate: DAY_1,
          subTodos: [createSubTodo({ id: 5 })],
        }),
        createParentTodo({ id: 2, startDate: DAY_1 }),
      ]),
    );
    queryClient.setQueryData(WEEK_COMPLETIONS, createCompletions(2, 0));
    const subToggle = respondWith({ id: 1 });
    const todoToggle = respondWith({ id: 2 });
    httpClient.patch
      .mockReturnValueOnce(todoToggle.response)
      .mockReturnValueOnce(subToggle.response);
    await act(async () => {
      mutations().toggleTodo.mutate({ todoId: 2, body: { completed: true }, date: DAY_1 });
    });
    await act(async () => {
      mutations().toggleSubTodo.mutate({ todoId: 1, subTodoId: 5, isCompleted: true, date: DAY_1 });
    });

    // When
    subToggle.settle();
    await flush();

    // Then
    expect(cachedTodo(LIST_DAY_1, 2)?.completed).toBe(true);
    expect(httpClient.get).not.toHaveBeenCalled();

    // When
    todoToggle.settle();
    await flush();

    // Then
    expect(isInvalidated(LIST_DAY_1)).toBe(true);
    expect(isInvalidated(WEEK_COMPLETIONS)).toBe(true);
  });

  it('하위 항목을 바꾸면 다른 날짜 목록에 남은 같은 할 일도 낡은 값으로 표시한다', async () => {
    // Given
    const { httpClient, queryClient, mutations, isInvalidated } = await renderMutations();
    const multiDay = createParentTodo({
      startDate: DAY_1,
      endDate: DAY_3,
      subTodos: [createSubTodo({ id: 5 })],
    });
    queryClient.setQueryData(LIST_DAY_1, toList([multiDay]));
    queryClient.setQueryData(LIST_DAY_2, toList([multiDay]));
    httpClient.patch.mockResolvedValue(ok({ message: 'ok', todo: createTodoDto({ id: 1 }) }));

    // When
    await act(async () => {
      await mutations().toggleSubTodo.mutateAsync({
        todoId: 1,
        subTodoId: 5,
        isCompleted: true,
        date: DAY_2,
      });
    });

    // Then
    expect(isInvalidated(LIST_DAY_1)).toBe(true);
  });

  it('진행 중이던 재조회 응답이 늦게 와도 낙관적 값을 덮지 않는다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    const todo = createParentTodo({
      startDate: DAY_1,
      subTodos: [createSubTodo({ id: 5 })],
    });
    queryClient.setQueryData(LIST_DAY_1, toList([todo]));
    const staleRefetch = createPendingResponse(toList([todo]));
    queryClient
      .query({ queryKey: LIST_DAY_1, queryFn: () => staleRefetch.response })
      .catch(() => undefined);
    const pending = respondWith({ id: 1 });
    httpClient.patch.mockReturnValue(pending.response);

    // When
    await act(async () => {
      mutations().toggleSubTodo.mutate({ todoId: 1, subTodoId: 5, isCompleted: true, date: DAY_1 });
    });
    staleRefetch.settle();
    await flush();

    // Then
    expect(progress(cachedTodo(LIST_DAY_1))).toEqual({ total: 1, completed: 1 });
    pending.settle();
    await flush();
  });

  it('제목 수정이 실패하면 제목만 돌아오고 같은 할 일의 다른 변경은 지킨다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([
        createParentTodo({
          startDate: DAY_1,
          subTodos: [createSubTodo({ id: 5, title: '이전' }), createSubTodo({ id: 6 })],
        }),
      ]),
    );
    const failedTitle = createPendingResponse(err(createTodoApiError()));
    const pendingToggle = respondWith({ id: 1 });
    httpClient.patch
      .mockReturnValueOnce(failedTitle.response)
      .mockReturnValueOnce(pendingToggle.response);
    await act(async () => {
      mutations().updateSubTodo.mutate({ todoId: 1, subTodoId: 5, title: '이후', date: DAY_1 });
    });
    await act(async () => {
      mutations().toggleSubTodo.mutate({ todoId: 1, subTodoId: 6, isCompleted: true, date: DAY_1 });
    });

    // When
    failedTitle.settle();
    await flush();

    // Then
    expect(cachedTodo(LIST_DAY_1)?.subTodos).toEqual([
      expect.objectContaining({ id: 5, title: '이전' }),
      expect.objectContaining({ id: 6, completed: true }),
    ]);
    pendingToggle.settle();
    await flush();
  });

  it('마지막 항목을 지우면 막대가 사라지고 실패하면 제자리로 돌아온다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([
        createParentTodo({
          startDate: DAY_1,
          subTodos: [createSubTodo({ id: 5 })],
        }),
      ]),
    );
    const failedDelete = createPendingResponse(err(createTodoApiError()));
    httpClient.delete.mockReturnValue(failedDelete.response);

    // When
    await act(async () => {
      mutations().deleteSubTodo.mutate({ todoId: 1, subTodoId: 5, date: DAY_1 });
    });

    // Then
    expect(progress(cachedTodo(LIST_DAY_1))).toEqual({ total: 0, completed: 0 });

    // When
    failedDelete.settle();
    await flush();

    // Then
    expect(cachedTodo(LIST_DAY_1)?.subTodos.map((subTodo) => subTodo.id)).toEqual([5]);
    expect(progress(cachedTodo(LIST_DAY_1))).toEqual({ total: 1, completed: 0 });
  });

  it('모두 체크해도 부모 할 일 완료는 그대로다(서버 규칙과 같다)', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([
        createParentTodo({
          startDate: DAY_1,
          subTodos: [createSubTodo({ id: 5 })],
        }),
      ]),
    );
    const pending = respondWith({ id: 1 });
    httpClient.patch.mockReturnValue(pending.response);

    // When
    await act(async () => {
      mutations().toggleSubTodo.mutate({ todoId: 1, subTodoId: 5, isCompleted: true, date: DAY_1 });
    });

    // Then
    expect(progress(cachedTodo(LIST_DAY_1))).toEqual({ total: 1, completed: 1 });
    expect(cachedTodo(LIST_DAY_1)?.completed).toBe(false);
    pending.settle();
    await flush();
  });

  it('순서 변경이 실패하면 순서만 돌아오고 진행 중인 체크는 지킨다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([
        createParentTodo({
          startDate: DAY_1,
          subTodos: [createSubTodo({ id: 5 }), createSubTodo({ id: 6 })],
        }),
      ]),
    );
    const failedReorder = createPendingResponse(err(createTodoApiError()));
    const pendingToggle = respondWith({ id: 1 });
    httpClient.patch
      .mockReturnValueOnce(failedReorder.response)
      .mockReturnValueOnce(pendingToggle.response);
    await act(async () => {
      mutations().reorderSubTodos.mutate({ todoId: 1, subTodoIds: [6, 5], date: DAY_1 });
    });
    await act(async () => {
      mutations().toggleSubTodo.mutate({ todoId: 1, subTodoId: 6, isCompleted: true, date: DAY_1 });
    });

    // When
    failedReorder.settle();
    await flush();

    // Then
    expect(cachedTodo(LIST_DAY_1)?.subTodos).toEqual([
      expect.objectContaining({ id: 5, completed: false }),
      expect.objectContaining({ id: 6, completed: true }),
    ]);
    pendingToggle.settle();
    await flush();
  });
});

describe('할 일 낙관적 갱신', () => {
  it('체크하면 달력의 그날 숫자가 바로 바뀌고 실패하면 돌아온다', async () => {
    // Given
    const { httpClient, queryClient, mutations } = await renderMutations();
    queryClient.setQueryData(LIST_DAY_1, toList([createParentTodo({ startDate: DAY_1 })]));
    queryClient.setQueryData(WEEK_COMPLETIONS, createCompletions(1, 0));
    const failed = createPendingResponse(err(createTodoApiError()));
    httpClient.patch.mockReturnValue(failed.response);
    const completions = () => queryClient.getQueryData<DailyCompletionsResult>(WEEK_COMPLETIONS);

    // When
    await act(async () => {
      mutations().toggleTodo.mutate({ todoId: 1, body: { completed: true }, date: DAY_1 });
    });

    // Then
    expect(completions()?.completions[0]).toEqual(
      expect.objectContaining({ completedTodos: 1, isComplete: true, completionRate: 100 }),
    );
    expect(completions()?.totalCompleteDays).toBe(1);

    // When
    failed.settle();
    await flush();

    // Then
    expect(completions()?.completions[0]).toEqual(
      expect.objectContaining({ completedTodos: 0, isComplete: false, completionRate: 0 }),
    );
    expect(completions()?.totalCompleteDays).toBe(0);
  });

  it('달력 숫자는 그날 목록처럼 기간 안의 여러 날 할 일도 센다', async () => {
    // Given
    const { httpClient, queryClient, mutations } = await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([
        createParentTodo({ startDate: DAY_1 }),
        createParentTodo({ id: 2, startDate: '2026-03-07', endDate: DAY_1 }),
      ]),
    );
    queryClient.setQueryData(WEEK_COMPLETIONS, createCompletions(1, 0));
    const pending = respondWith({ id: 1 });
    httpClient.patch.mockReturnValue(pending.response);

    // When
    await act(async () => {
      mutations().toggleTodo.mutate({ todoId: 1, body: { completed: true }, date: DAY_1 });
    });

    // Then
    expect(
      queryClient.getQueryData<DailyCompletionsResult>(WEEK_COMPLETIONS)?.completions[0],
    ).toEqual(expect.objectContaining({ totalTodos: 2, completedTodos: 1, isComplete: false }));
    pending.settle();
    await flush();
  });

  it('반복 할 일을 체크해도 반복 규칙 칸은 그대로고 그 회차만 바뀐다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo } = await renderMutations();
    const repeat = {
      frequency: 'DAILY',
      interval: 1,
      daysOfWeek: [],
      monthDay: null,
      end: { type: 'NEVER' },
    };
    const occurrence = createParentTodo({
      startDate: DAY_1,
      recurrenceGroupId: 'series-1',
      repeat: JSON.parse(JSON.stringify(repeat)),
    });
    queryClient.setQueryData(LIST_DAY_1, toList([occurrence]));
    queryClient.setQueryData(LIST_DAY_2, toList([{ ...occurrence, id: 2, startDate: DAY_2 }]));
    const pending = respondWith({ id: 1 });
    httpClient.patch.mockReturnValue(pending.response);

    // When
    await act(async () => {
      mutations().toggleTodo.mutate({ todoId: 1, body: { completed: true }, date: DAY_1 });
    });

    // Then
    expect(cachedTodo(LIST_DAY_1)?.repeat).toEqual(occurrence.repeat);
    expect(cachedTodo(LIST_DAY_1)?.completed).toBe(true);
    expect(cachedTodo(LIST_DAY_2, 2)?.completed).toBe(false);
    pending.settle();
    await flush();
  });

  it('체크와 하위 항목 변경은 열린 상세 화면 숫자에도 바로 보인다', async () => {
    // Given
    const { httpClient, queryClient, mutations } = await renderMutations();
    const todo = createParentTodo({
      startDate: DAY_1,
      subTodos: [createSubTodo({ id: 5 })],
    });
    const detailsKey = TODO_QUERY_KEYS.detail({ todoId: 1 });
    queryClient.setQueryData(LIST_DAY_1, toList([todo]));
    queryClient.setQueryData<TodoDetails>(detailsKey, {
      todo,
      owner: { id: 'u', name: null, profileImage: null },
      permissions: { canEdit: true, canComment: true, canNudge: false },
      metrics: { viewCount: 0, commentCount: 0 },
    });
    const pending = respondWith({ id: 1 });
    httpClient.patch.mockReturnValue(pending.response);

    // When
    await act(async () => {
      mutations().toggleSubTodo.mutate({ todoId: 1, subTodoId: 5, isCompleted: true, date: DAY_1 });
    });

    // Then
    expect(progress(queryClient.getQueryData<TodoDetails>(detailsKey)?.todo)).toEqual({
      total: 1,
      completed: 1,
    });
    pending.settle();
    await flush();
  });

  it('만들면 임시 행과 달력 숫자가 바로 늘고 실패하면 행이 빠지고 서버 값으로 다시 맞춘다', async () => {
    // Given
    const { httpClient, queryClient, mutations, isInvalidated } = await renderMutations();
    queryClient.setQueryData(LIST_DAY_1, toList([]));
    queryClient.setQueryData(WEEK_COMPLETIONS, createCompletions(0, 0));
    queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
      categories: [{ ...CATEGORY, sortOrder: 0, todoCount: 0 }],
    });
    const failed = createPendingResponse(err(createTodoApiError()));
    httpClient.post.mockReturnValue(failed.response);
    const todos = () => queryClient.getQueryData<TodoListResult>(LIST_DAY_1)?.todos;

    // When
    await act(async () => {
      mutations()
        .createTodo.mutateAsync({
          input: {
            title: '새 할 일',
            startDate: DAY_1,
            endDate: DAY_3,
            isAllDay: true,
            visibility: 'PUBLIC',
            categoryId: CATEGORY.id,
          },
        })
        .catch(() => undefined);
    });

    // Then
    expect(todos()).toHaveLength(1);
    expect(todos()?.[0]?.endDate).toBe(DAY_3);
    expect(
      queryClient.getQueryData<DailyCompletionsResult>(WEEK_COMPLETIONS)?.completions[0]
        ?.totalTodos,
    ).toBe(1);

    // When
    failed.settle();
    await flush();

    // Then
    expect(todos()).toHaveLength(0);
    expect(
      queryClient.getQueryData<DailyCompletionsResult>(WEEK_COMPLETIONS)?.completions[0]
        ?.totalTodos ?? 0,
    ).toBe(0);
    expect(isInvalidated(LIST_DAY_1)).toBe(true);
  });

  it('만든 응답이 오면 임시 행을 서버 행으로 바꾸고 여러 날 목록도 낡은 값으로 표시한다', async () => {
    // Given
    const { httpClient, queryClient, mutations, cachedTodo, isInvalidated } =
      await renderMutations();
    queryClient.setQueryData(LIST_DAY_1, toList([]));
    queryClient.setQueryData(LIST_DAY_3, toList([]));
    queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
      categories: [{ ...CATEGORY, sortOrder: 0, todoCount: 0 }],
    });
    httpClient.post.mockResolvedValue(
      ok({ message: 'ok', todo: createTodoDto({ id: 501, startDate: DAY_1, endDate: DAY_3 }) }),
    );

    // When
    await act(async () => {
      await mutations().createTodo.mutateAsync({
        input: {
          title: '새 할 일',
          startDate: DAY_1,
          endDate: DAY_3,
          isAllDay: true,
          visibility: 'PUBLIC',
          categoryId: CATEGORY.id,
        },
      });
    });

    // Then
    expect(cachedTodo(LIST_DAY_1, 501)).toBeDefined();
    expect(queryClient.getQueryData<TodoListResult>(LIST_DAY_1)?.todos).toHaveLength(1);
    expect(isInvalidated(LIST_DAY_3)).toBe(true);
  });

  it('만드는 동안의 임시 행도 서버 응답도 고른 벽시계를 그대로 보여 준다', async () => {
    // Given
    const { httpClient, queryClient, mutations } = await renderMutations();
    queryClient.setQueryData(LIST_DAY_1, toList([]));
    queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
      categories: [{ ...CATEGORY, sortOrder: 0, todoCount: 0 }],
    });
    const pending = createPendingResponse(
      ok({
        message: 'ok',
        todo: createTodoDto({
          id: 502,
          startDate: DAY_1,
          scheduledTime: '2026-03-08T01:00:00.000Z',
          scheduledLocalTime: '10:00',
        }),
      }),
    );
    httpClient.post.mockReturnValue(pending.response);
    const firstTodo = () => queryClient.getQueryData<TodoListResult>(LIST_DAY_1)?.todos[0];

    // When
    await act(async () => {
      mutations()
        .createTodo.mutateAsync({
          input: {
            title: '새 할 일',
            startDate: DAY_1,
            scheduledTime: '10:00',
            isAllDay: false,
            visibility: 'PUBLIC',
            categoryId: CATEGORY.id,
          },
        })
        .catch(() => undefined);
    });
    const optimisticTime = firstTodo()?.localTime;
    pending.settle();
    await flush();

    // Then
    expect(optimisticTime).toBe('10:00');
    expect(firstTodo()).toMatchObject({ id: 502, localTime: '10:00' });
  });

  it('여러 날 할 일을 다른 날짜에서 지우면 그 목록에서 바로 빠지고 시작일 목록도 낡은 값으로 표시한다', async () => {
    // Given
    const { httpClient, queryClient, mutations, isInvalidated } = await renderMutations();
    const multiDay = createParentTodo({ startDate: DAY_1, endDate: DAY_3 });
    queryClient.setQueryData(LIST_DAY_1, toList([multiDay]));
    queryClient.setQueryData(LIST_DAY_2, toList([multiDay]));
    const pending = createPendingResponse(ok(undefined));
    httpClient.delete.mockReturnValue(pending.response);

    // When
    await act(async () => {
      mutations().deleteTodo.mutate({ todoId: 1, date: DAY_2 });
    });

    // Then
    expect(queryClient.getQueryData<TodoListResult>(LIST_DAY_2)?.todos).toHaveLength(0);

    // When
    pending.settle();
    await flush();

    // Then
    expect(isInvalidated(LIST_DAY_1)).toBe(true);
  });

  it('지우면 달력 숫자가 바로 줄고 실패하면 제자리로 돌아온다', async () => {
    // Given
    const { httpClient, queryClient, mutations } = await renderMutations();
    queryClient.setQueryData(
      LIST_DAY_1,
      toList([
        createParentTodo({ startDate: DAY_1 }),
        createParentTodo({ id: 2, startDate: DAY_1 }),
      ]),
    );
    queryClient.setQueryData(WEEK_COMPLETIONS, createCompletions(2, 0));
    const failed = createPendingResponse(err(createTodoApiError()));
    httpClient.delete.mockReturnValue(failed.response);
    const totalTodos = () =>
      queryClient.getQueryData<DailyCompletionsResult>(WEEK_COMPLETIONS)?.completions[0]
        ?.totalTodos;

    // When
    await act(async () => {
      mutations().deleteTodo.mutate({ todoId: 1, date: DAY_1 });
    });

    // Then
    expect(totalTodos()).toBe(1);

    // When
    failed.settle();
    await flush();

    // Then
    expect(totalTodos()).toBe(2);
    expect(queryClient.getQueryData<TodoListResult>(LIST_DAY_1)?.todos.map((t) => t.id)).toEqual([
      1, 2,
    ]);
  });
});
