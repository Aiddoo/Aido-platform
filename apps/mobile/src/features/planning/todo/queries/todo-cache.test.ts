import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/constants/todo-category-query-keys';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import {
  invalidateFeedTodos,
  invalidateTodoDependentQueries,
  invalidateTodos,
  syncDailyCompletionWithList,
} from './todo-cache';

describe('todo cache invalidation', () => {
  const listKey = TODO_QUERY_KEYS.listByDate({ date: '2026-07-14' });
  const completionKey = TODO_QUERY_KEYS.completionsByRange({ startDate: 'a', endDate: 'b' });
  const friendKey = TODO_QUERY_KEYS.friendListByDate({ userId: 'u', date: 'd' });
  const categoryKey = TODO_CATEGORY_QUERY_KEYS.list();

  function createSeededClient() {
    const client = createTestQueryClient();
    client.setQueryData(listKey, { todos: [] });
    client.setQueryData(completionKey, []);
    client.setQueryData(friendKey, []);
    client.setQueryData(categoryKey, { categories: [] });

    return client;
  }

  it('할 일과 카테고리 캐시를 모두 무효화한다', async () => {
    // Given
    const client = createSeededClient();

    // When
    await invalidateTodos(client);

    // Then
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(friendKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(categoryKey)?.isInvalidated).toBe(true);
  });

  it('할 일이 바뀌면 refreshOnTodoChange로 밝힌 다른 피처의 조회만 무효화한다', async () => {
    // Given
    const client = createSeededClient();
    const dependentKey = ['other-feature', 'depends-on-todo'];
    const independentKey = ['other-feature', 'independent'];
    client.setQueryData(dependentKey, 1);
    client.setQueryData(independentKey, 1);
    client
      .getQueryCache()
      .find({ queryKey: dependentKey })
      ?.setOptions({
        meta: { refreshOnTodoChange: true },
      });

    // When
    await invalidateTodoDependentQueries(client);

    // Then
    expect(client.getQueryState(dependentKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(independentKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(false);
  });

  it('피드를 새로 고치면 목록과 완료 통계만 무효화한다', async () => {
    // Given
    const client = createSeededClient();

    // When
    await invalidateFeedTodos(client);

    // Then
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(completionKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(friendKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(categoryKey)?.isInvalidated).toBe(false);
  });

  it('달력 요약을 맞출 때 같은 접두사의 위젯 요약·존재 여부 캐시는 건드리지 않는다', () => {
    // Given
    const client = createSeededClient();
    client.removeQueries({ queryKey: completionKey });
    const widgetKey = TODO_QUERY_KEYS.widgetSummaryByDate({ date: '2026-07-14', userId: 'u' });
    const widgetSummary = { date: '2026-07-14', totalTodos: 3 };
    const existence = { hasTodo: true, hasCompletedTodo: false };
    client.setQueryData(widgetKey, widgetSummary);
    client.setQueryData(TODO_QUERY_KEYS.existence(), existence);
    client.setQueryData(listKey, { todos: [], hasNext: false, nextCursor: null });
    const rangeKey = TODO_QUERY_KEYS.completionsByRange({
      startDate: '2026-07-13',
      endDate: '2026-07-19',
    });
    client.setQueryData(rangeKey, {
      completions: [
        {
          date: '2026-07-14',
          totalTodos: 1,
          completedTodos: 0,
          isComplete: false,
          completionRate: 0,
          categoryColors: [],
        },
      ],
      totalCompleteDays: 0,
      dateRange: { startDate: '2026-07-13', endDate: '2026-07-19' },
    });

    // When
    syncDailyCompletionWithList(client, { date: '2026-07-14' });

    // Then
    expect(client.getQueryData(widgetKey)).toBe(widgetSummary);
    expect(client.getQueryData(TODO_QUERY_KEYS.existence())).toBe(existence);
    expect(client.getQueryData(rangeKey)).toEqual(expect.objectContaining({ completions: [] }));
  });
});
