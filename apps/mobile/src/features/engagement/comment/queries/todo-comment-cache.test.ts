import { QueryClient } from '@tanstack/react-query';

import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys';
import { cancelTodoCommentQueries } from './todo-comment-cache';

describe('cancelTodoCommentQueries', () => {
  it('처음 받는 중인 답글 쿼리는 끊지 않고 끝까지 받는다', async () => {
    // Given
    const queryClient = new QueryClient();
    const queryKey = TODO_COMMENT_QUERY_KEYS.replies({
      todoId: 1,
      commentId: 'c1',
      aroundReplyId: null,
    });
    const fetching = queryClient.fetchQuery({
      queryKey,
      queryFn: () => new Promise<string>((resolve) => setTimeout(() => resolve('replies'), 10)),
    });

    // When
    await cancelTodoCommentQueries({ queryClient, todoId: 1 });
    await fetching;

    // Then
    expect(queryClient.getQueryState(queryKey)?.status).toBe('success');
  });

  it('이미 받은 데이터가 있는 쿼리는 다시 받는 중이어도 멈춘다', async () => {
    // Given
    const queryClient = new QueryClient();
    const queryKey = TODO_COMMENT_QUERY_KEYS.threads({
      todoId: 1,
      sort: 'LATEST',
      anchorCommentId: null,
    });
    queryClient.setQueryData(queryKey, 'old');
    const refetching = queryClient.fetchQuery({
      queryKey,
      staleTime: 0,
      queryFn: () => new Promise<string>((resolve) => setTimeout(() => resolve('new'), 50)),
    });

    // When
    await cancelTodoCommentQueries({ queryClient, todoId: 1 });
    await refetching.catch(() => undefined);

    // Then
    expect(queryClient.getQueryData(queryKey)).toBe('old');
  });
});
