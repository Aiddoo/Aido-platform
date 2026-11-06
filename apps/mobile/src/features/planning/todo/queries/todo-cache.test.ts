import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import type { QueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { invalidateFeedTodos, invalidateTodos, syncDailyCompletionWithList } from './todo-cache';

describe('todo cache invalidation', () => {
  let client: QueryClient;
  const listKey = TODO_QUERY_KEYS.listByDate({ date: '2026-07-14' });
  const completionKey = TODO_QUERY_KEYS.completionsByRange({ startDate: 'a', endDate: 'b' });
  const friendKey = TODO_QUERY_KEYS.friendListByDate({ userId: 'u', date: 'd' });
  const categoryKey = TODO_CATEGORY_QUERY_KEYS.list();

  beforeEach(() => {
    client = createTestQueryClient();
    client.setQueryData(listKey, { todos: [] });
    client.setQueryData(completionKey, []);
    client.setQueryData(friendKey, []);
    client.setQueryData(categoryKey, { categories: [] });
  });

  it('Given 할 일과 카테고리 캐시, When invalidateTodos를 호출하면, Then 모두 무효화한다', async () => {
    await invalidateTodos(client);

    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(friendKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(categoryKey)?.isInvalidated).toBe(true);
  });

  it('Given 피드 캐시, When invalidateFeedTodos를 호출하면, Then 목록·완료 통계만 무효화한다', async () => {
    await invalidateFeedTodos(client);

    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(completionKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(friendKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(categoryKey)?.isInvalidated).toBe(false);
  });

  it('달력 요약을 맞출 때 같은 접두사의 위젯 요약·존재 여부 캐시는 건드리지 않는다', () => {
    // Given
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
