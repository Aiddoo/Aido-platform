import { createTestQueryClient } from '@src/testing/core';

import { createTodoComment, createTodoCommentThread } from '../__tests__/todo-comment.fixtures';
import type { TodoCommentThread } from '../domains/todo-comment.model';
import { patchTodoCommentCaches } from '../queries/todo-comment-cache';
import { TODO_COMMENT_QUERY_KEYS } from '../queries/todo-comment-query-keys';
import type { TodoCommentThreadPages } from './todo-comment-cache-pages';

const TODO_ID = 1;
const QUERY_KEY = TODO_COMMENT_QUERY_KEYS.threads({
  todoId: TODO_ID,
  sort: 'LATEST',
  anchorCommentId: null,
});

function createThreadPages(...pages: TodoCommentThread[][]): TodoCommentThreadPages {
  return {
    pages: pages.map((items) => ({
      items,
      pagination: {
        previousCursor: null,
        nextCursor: null,
        hasPrevious: false,
        hasNext: false,
        size: 10,
      },
      anchor: null,
    })),
    pageParams: pages.map((_page, index) => (index === 0 ? null : `cursor-${index}`)),
  };
}

function createLonelyThread(id: string) {
  return createTodoCommentThread({
    comment: createTodoComment({ id, replyCount: 0 }),
    previewReply: null,
  });
}

describe('patchTodoCommentCaches', () => {
  it('댓글 하나를 바꿔도 바뀌지 않은 페이지와 묶음은 캐시에서 같은 참조로 남는다', () => {
    // Given
    const queryClient = createTestQueryClient();
    const target = createTodoCommentThread();
    queryClient.setQueryData(
      QUERY_KEY,
      createThreadPages([target, createLonelyThread('sibling')], [createLonelyThread('other')]),
    );
    const before = queryClient.getQueryData<TodoCommentThreadPages>(QUERY_KEY);

    // When
    patchTodoCommentCaches(queryClient, {
      todoId: TODO_ID,
      commentId: target.comment.id,
      transform: (comment) => ({ ...comment, likeCount: 7 }),
    });

    // Then
    const after = queryClient.getQueryData<TodoCommentThreadPages>(QUERY_KEY);
    expect(after?.pages[0]?.items[0]?.comment.likeCount).toBe(7);
    expect(after?.pages[0]?.items[1]).toBe(before?.pages[0]?.items[1]);
    expect(after?.pages[1]).toBe(before?.pages[1]);
  });

  it('바꿀 댓글이 없으면 캐시 데이터가 같은 참조로 남는다', () => {
    // Given
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(QUERY_KEY, createThreadPages([createTodoCommentThread()]));
    const before = queryClient.getQueryData<TodoCommentThreadPages>(QUERY_KEY);

    // When
    patchTodoCommentCaches(queryClient, {
      todoId: TODO_ID,
      commentId: 'missing',
      transform: (comment) => ({ ...comment, likeCount: 1 }),
    });

    // Then
    expect(queryClient.getQueryData<TodoCommentThreadPages>(QUERY_KEY)).toBe(before);
  });
});
