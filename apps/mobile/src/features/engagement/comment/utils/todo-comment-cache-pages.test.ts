import { createTestQueryClient } from '@src/testing/core';

import {
  createTodoComment,
  createTodoCommentReply,
  createTodoCommentThread,
} from '../__tests__/todo-comment.fixtures';
import type { TodoComment, TodoCommentThread } from '../domains/todo-comment.model';
import { patchTodoCommentCaches } from '../queries/todo-comment-cache';
import { TODO_COMMENT_QUERY_KEYS } from '../queries/todo-comment-query-keys';
import {
  addRepliesToThreadPages,
  appendRepliesToReplyPages,
  findCommentInReplyPages,
  findCommentInThreadPages,
  findThreadPlacement,
  patchCommentInThreadPages,
  removeCommentFromReplyPages,
  removeCommentFromThreadPages,
  restoreCommentInThreadPages,
  type TodoCommentReplyPages,
  type TodoCommentThreadPages,
} from './todo-comment-cache-pages';

const pagination = (hasNext: boolean) => ({
  previousCursor: null,
  nextCursor: hasNext ? 'next' : null,
  hasPrevious: false,
  hasNext,
  size: 10,
});

function threadPages(...pages: TodoCommentThread[][]): TodoCommentThreadPages {
  return {
    pages: pages.map((items) => ({ items, pagination: pagination(false), anchor: null })),
    pageParams: pages.map((_page, index) => (index === 0 ? null : `cursor-${index}`)),
  };
}

function replyPages(hasNext: boolean, ...pages: TodoComment[][]): TodoCommentReplyPages {
  return {
    pages: pages.map((items) => ({ items, pagination: pagination(hasNext) })),
    pageParams: pages.map((_page, index) => (index === 0 ? null : `cursor-${index}`)),
  };
}

describe('todo-comment-cache-pages', () => {
  it('댓글 하나만 바꾸고 나머지 묶음은 그대로 둔다', () => {
    // Given
    const target = createTodoCommentThread();
    const other = createTodoCommentThread({
      comment: createTodoComment({ id: 'other', replyCount: 0 }),
      previewReply: null,
    });
    const data = threadPages([target], [other]);

    // When
    const next = patchCommentInThreadPages(data, target.comment.id, (comment) => ({
      ...comment,
      likeCount: 7,
    }));

    // Then
    expect(next?.pages[0]?.items[0]?.comment.likeCount).toBe(7);
    expect(next?.pages[1]).toEqual(data.pages[1]);
  });

  it('대표 답글로 보인 답글도 묶음 캐시에서 찾는다', () => {
    // Given
    const thread = createTodoCommentThread();
    const data = threadPages([thread]);

    // When
    const found = findCommentInThreadPages(data, thread.previewReply?.id ?? '');

    // Then
    expect(found).toBe(thread.previewReply);
  });

  it('답글 없는 댓글을 지우면 그 묶음이 목록에서 빠진다', () => {
    // Given
    const lonely = createTodoCommentThread({
      comment: createTodoComment({ id: 'lonely', replyCount: 0 }),
      previewReply: null,
    });
    const kept = createTodoCommentThread();
    const data = threadPages([lonely, kept]);

    // When
    const next = removeCommentFromThreadPages(data, lonely.comment);

    // Then
    expect(next?.pages[0]?.items).toEqual([kept]);
  });

  it('펼친 답글 목록에서 지운 답글만 뺀다', () => {
    // Given
    const head = createTodoComment();
    const first = createTodoCommentReply(head, { id: 'r1' });
    const second = createTodoCommentReply(head, { id: 'r2' });
    const data = replyPages(false, [first, second]);

    // When
    const next = removeCommentFromReplyPages(data, 'r1');

    // Then
    expect(next?.pages[0]?.items).toEqual([second]);
    expect(findCommentInReplyPages(next, 'r2')).toBe(second);
  });

  it('방금 쓴 답글은 남은 페이지가 있어도 마지막 페이지 끝에 붙는다', () => {
    // Given
    const head = createTodoComment();
    const existing = createTodoCommentReply(head, { id: 'r1' });
    const posted = createTodoCommentReply(head, { id: 'r2' });

    // When
    const next = appendRepliesToReplyPages(replyPages(true, [existing]), [posted]);

    // Then
    expect(next?.pages[0]?.items).toEqual([existing, posted]);
  });

  it('새 답글은 그 묶음의 답글 수만 늘린다', () => {
    // Given
    const target = createTodoCommentThread();
    const other = createTodoCommentThread({
      comment: createTodoComment({ id: 'other', replyCount: 1 }),
    });
    const posted = createTodoCommentReply(target.comment, { id: 'posted' });

    // When
    const next = addRepliesToThreadPages(threadPages([target, other]), target.comment.id, [posted]);

    // Then
    expect(next?.pages[0]?.items[0]?.replySummary.totalCount).toBe(2);
    expect(next?.pages[0]?.items[1]).toEqual(other);
  });

  const repliedThread = createTodoCommentThread({
    comment: createTodoComment({ id: 'replied', replyCount: 1 }),
  });
  const lonelyThread = createTodoCommentThread({
    comment: createTodoComment({ id: 'lonely', replyCount: 0 }),
    previewReply: null,
  });

  it.each([
    {
      title: '지운 대표 답글을 되돌리면 그 묶음의 답글 수와 대표 답글이 돌아온다',
      thread: repliedThread,
      removed: repliedThread.previewReply ?? repliedThread.comment,
    },
    {
      title: '답글 없는 댓글을 되돌리면 빠진 묶음이 원래 자리로 돌아온다',
      thread: lonelyThread,
      removed: lonelyThread.comment,
    },
  ])('$title', ({ thread, removed }) => {
    // Given
    const other = createTodoCommentThread({
      comment: createTodoComment({ id: 'other', replyCount: 0 }),
      previewReply: null,
    });
    const data = threadPages([thread, other]);
    const placement = findThreadPlacement(data, removed);
    // 지운 뒤 그사이 다른 댓글에 하트를 눌렀다
    const changed = patchCommentInThreadPages(
      removeCommentFromThreadPages(data, removed),
      other.comment.id,
      (comment) => ({ ...comment, likeCount: 1 }),
    );

    // When
    const next =
      placement == null ? null : restoreCommentInThreadPages(changed, removed, placement);

    // Then
    expect(next?.pages[0]?.items[0]).toEqual(thread);
    expect(next?.pages[0]?.items[1]?.comment.likeCount).toBe(1);
  });
});

const TODO_ID = 1;
const QUERY_KEY = TODO_COMMENT_QUERY_KEYS.threads({
  todoId: TODO_ID,
  sort: 'LATEST',
  anchorCommentId: null,
});

function createLonelyThread(id: string) {
  return createTodoCommentThread({
    comment: createTodoComment({ id, replyCount: 0 }),
    previewReply: null,
  });
}

describe('patchTodoCommentCaches — 쿼리 캐시 반영', () => {
  it('댓글 하나를 바꿔도 바뀌지 않은 페이지와 묶음은 캐시에서 같은 참조로 남는다', () => {
    // Given
    const queryClient = createTestQueryClient();
    const target = createTodoCommentThread();
    queryClient.setQueryData(
      QUERY_KEY,
      threadPages([target, createLonelyThread('sibling')], [createLonelyThread('other')]),
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
    queryClient.setQueryData(QUERY_KEY, threadPages([createTodoCommentThread()]));
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
