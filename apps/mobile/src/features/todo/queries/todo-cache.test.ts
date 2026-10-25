import { QueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { invalidateFeedTodos, invalidateTodos } from './todo-cache';

describe('todo cache invalidation', () => {
  let client: QueryClient;
  const listKey = TODO_QUERY_KEYS.listByDate({ date: '2026-07-14' });
  const completionKey = TODO_QUERY_KEYS.completionsByRange({ startDate: 'a', endDate: 'b' });
  const friendKey = TODO_QUERY_KEYS.friendListByDate({ userId: 'u', date: 'd' });
  const categoryKey = TODO_CATEGORY_QUERY_KEYS.list();

  beforeEach(() => {
    client = new QueryClient();
    client.setQueryData(listKey, { todos: [] });
    client.setQueryData(completionKey, []);
    client.setQueryData(friendKey, []);
    client.setQueryData(categoryKey, { categories: [] });
  });

  afterEach(() => {
    client.clear();
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
});
