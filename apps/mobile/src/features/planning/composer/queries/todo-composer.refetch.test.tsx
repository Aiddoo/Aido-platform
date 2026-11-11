import type { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import '@src/shared/i18n/init';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import {
  createDailyCompletionsDto,
  createTodoApiError,
  createTodoDto,
  createTodoListResponseDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import {
  useGetDailyCompletionsQueryOptions,
  useGetTodoExistenceQueryOptions,
  useGetTodosByDateQueryOptions,
  useGetTodoSummaryQueryOptions,
} from '@src/features/planning/todo/queries/todo.queries';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import {
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { hashKey, useMutation, useQuery } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { Profiler } from 'react';

import { useCreateTodoMutationOptions } from './todo-composer.mutations';

const DAY = '2026-03-08';
const MONTH = { startDate: '2026-02-23', endDate: '2026-04-05' };
const WEEK = { startDate: '2026-03-02', endDate: '2026-03-08' };
const BLUE = '#3B82F6';
const RED = '#EF4444';
const EXISTING = createTodoDto({
  id: 1,
  startDate: DAY,
  category: { id: 2, name: '업무', color: RED, sortOrder: 1 },
});
const CREATED = createTodoDto({ id: 501, title: '새 할 일', startDate: DAY, sortOrder: 1 });
const INPUT = {
  title: '새 할 일',
  startDate: DAY,
  isAllDay: true,
  visibility: 'PUBLIC' as const,
  categoryId: 1,
};

function completionsDto(range: { startDate: string; endDate: string }, hasCreated: boolean) {
  return createDailyCompletionsDto({
    completions: [
      {
        date: DAY,
        totalTodos: hasCreated ? 2 : 1,
        completedTodos: 0,
        isComplete: false,
        completionRate: 0,
        // 서버는 GROUP BY 순서로 색을 모아 목록 순서와 다를 수 있다
        categoryColors: hasCreated ? [BLUE, RED] : [RED],
      },
    ],
    totalCompleteDays: 0,
    dateRange: range,
  });
}

function respondAsServer(
  url: string,
  params: Record<string, unknown> | undefined,
  hasCreated: boolean,
) {
  if (url === 'v1/todo-categories') {
    return ok(createTodoCategoryListDto());
  }
  if (url === 'v1/daily-completions') {
    return ok(completionsDto(params?.startDate === WEEK.startDate ? WEEK : MONTH, hasCreated));
  }
  if (url === 'v1/todos/summary') {
    return ok({
      date: DAY,
      totalTodos: hasCreated ? 2 : 1,
      completedTodos: 0,
      completionRate: 0,
      isComplete: false,
      currentStreak: 0,
      topTodos: [],
    });
  }
  return ok(createTodoListResponseDto({ items: hasCreated ? [EXISTING, CREATED] : [EXISTING] }));
}

function FeedCalendarProbe() {
  // MyCalendar처럼 data와 isError만 읽는다
  const query = useQuery(useGetDailyCompletionsQueryOptions(MONTH));
  return query.isError || query.data == null ? null : null;
}

function FeedListProbe() {
  // TodoList처럼 목록·카테고리 data와 dataUpdatedAt을 읽는다
  const categories = useQuery(useGetTodoCategoriesQueryOptions());
  const list = useQuery(useGetTodosByDateQueryOptions({ date: DAY }));
  return categories.data == null || list.data == null || list.dataUpdatedAt < 0 ? null : null;
}

function BackgroundProbe() {
  // 위젯 동기화·시작 체크리스트가 피드 뒤에서 붙들고 있는 조회
  useQuery(useGetTodoSummaryQueryOptions({ date: DAY }));
  useQuery(useGetDailyCompletionsQueryOptions(WEEK));
  useQuery(useGetTodoExistenceQueryOptions());
  return null;
}

/** TanStack notifyManager는 구독자 알림을 setTimeout(0)으로 미뤄 act 안에서 한 틱을 기다린다 */
function deliverQueryNotifications() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

type CreateTodo = ReturnType<typeof useCreateTodo>['mutateAsync'];

function useCreateTodo() {
  return useMutation(useCreateTodoMutationOptions());
}

async function renderFeed() {
  const httpClient = createHttpClientStub();
  const server = { hasCreated: false };
  const heldGets: Array<() => void> = [];
  httpClient.get.mockImplementation(async (url, options) => {
    const response = respondAsServer(url, options?.params, server.hasCreated);
    if (!server.hasCreated) {
      return response;
    }
    // 만든 뒤 다시 받는 응답은 붙잡아 두었다가 따로 돌려 렌더를 단계별로 센다
    const pending = createPendingResponse(response);
    heldGets.push(pending.settle);
    return pending.response;
  });
  const created = createPendingResponse<Result<unknown, ApiError>>(
    ok({ message: 'ok', todo: CREATED }),
  );
  const failed = createPendingResponse<Result<unknown, ApiError>>(err(createTodoApiError()));
  let createResponse = created;
  httpClient.post.mockImplementation(() => {
    server.hasCreated = createResponse === created;
    return createResponse.response;
  });
  // 운영처럼 5분 동안 신선해 붙을 때 다시 받지 않는다
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: 5 * MINUTE_MS } },
  });
  const renders = { calendar: 0, list: 0 };
  const mutation: { createTodo: CreateTodo | null } = { createTodo: null };

  function MutationProbe({ onRender }: { onRender: (createTodo: CreateTodo) => void }) {
    onRender(useCreateTodo().mutateAsync);
    return null;
  }

  await renderScreen(
    <>
      <Profiler id="calendar" onRender={() => (renders.calendar += 1)}>
        <FeedCalendarProbe />
      </Profiler>
      <Profiler id="list" onRender={() => (renders.list += 1)}>
        <FeedListProbe />
      </Profiler>
      <BackgroundProbe />
      <MutationProbe
        onRender={(createTodo) => {
          mutation.createTodo = createTodo;
        }}
      />
    </>,
    { queryClient, withLocalDate: true, di: { httpClient } },
  );
  await act(deliverQueryNotifications);

  const refetched: string[] = [];
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'fetch') {
      refetched.push(event.query.queryHash);
    }
  });
  renders.calendar = 0;
  renders.list = 0;
  httpClient.get.mockClear();

  /** 사용자가 저장을 누르고 → 서버가 답하고 → 다시 받은 응답이 오는 세 단계를 따로 그린다 */
  async function addTodo() {
    await act(async () => {
      mutation.createTodo?.({ input: INPUT }).catch(noop);
      await deliverQueryNotifications();
    });
    await act(async () => {
      createResponse.settle();
      await deliverQueryNotifications();
    });
    await act(async () => {
      heldGets.splice(0).forEach((settle) => settle());
      await deliverQueryNotifications();
    });
  }

  function failCreate() {
    createResponse = failed;
  }

  return { httpClient, queryClient, renders, refetched, addTodo, failCreate };
}

describe('할 일을 만든 뒤 다시 받는 조회', () => {
  it('하루짜리를 만들면 서버만 아는 위젯 요약만 다시 받고 달력은 낙관적 반영 한 번만 그린다', async () => {
    // Given
    const { httpClient, renders, refetched, addTodo } = await renderFeed();

    // When
    await addTodo();

    // Then
    expect(refetched).toEqual([
      hashKey(TODO_QUERY_KEYS.widgetSummaryByDate({ date: DAY, userId: null })),
    ]);
    expect(httpClient.get).toHaveBeenCalledTimes(1);
    expect(renders).toEqual({ calendar: 1, list: 2 });
  });

  it('만들기가 실패하면 고친 날짜 목록과 그날 달력 범위를 서버 값으로 다시 맞춘다', async () => {
    // Given
    const { queryClient, refetched, addTodo, failCreate } = await renderFeed();
    failCreate();

    // When
    await addTodo();

    // Then
    expect(refetched).toEqual(
      expect.arrayContaining([
        hashKey(TODO_QUERY_KEYS.listByDate({ date: DAY })),
        hashKey(TODO_QUERY_KEYS.completionsByRange(MONTH)),
        hashKey(TODO_QUERY_KEYS.completionsByRange(WEEK)),
      ]),
    );
    expect(queryClient.getQueryData(TODO_QUERY_KEYS.listByDate({ date: DAY }))?.todos).toHaveLength(
      1,
    );
  });
});
