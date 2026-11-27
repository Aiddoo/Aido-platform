import { createPendingResponse, createTestQueryClient } from '@src/testing/core';
import { InfiniteQueryObserver, type QueryClient } from '@tanstack/react-query';
import { noop } from 'es-toolkit';

import { createTodoComment, createTodoCommentThread } from '../__tests__/todo-comment.fixtures';
import type { TodoCommentThread } from '../domains/todo-comment-thread.model';
import { patchTodoCommentCaches, settleTodoCommentEdit } from './todo-comment-cache';
import { TODO_COMMENT_MUTATION_KEYS } from './todo-comment-mutation-keys';
import type { TodoCommentThreadPages } from './todo-comment-pages-cache';
import { TODO_COMMENT_QUERY_KEYS } from './todo-comment-query-keys';

function threadPages(...pages: TodoCommentThread[][]): TodoCommentThreadPages {
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

describe('patchTodoCommentCaches', () => {
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

describe('settleTodoCommentEdit', () => {
  const EDITED_ID = 'edited';
  const POPULAR_KEY = TODO_COMMENT_QUERY_KEYS.threads({
    todoId: TODO_ID,
    sort: 'POPULAR',
    anchorCommentId: null,
  });

  function createEditedThread(content: string) {
    return createTodoCommentThread({
      comment: createTodoComment({ id: EDITED_ID, replyCount: 0, content }),
      previewReply: null,
    });
  }

  /** 보고 있는 최신순 목록. 다시 받으면 서버가 가진 글이 온다 */
  function observeThreads(queryClient: QueryClient) {
    const [serverPage] = threadPages([createEditedThread('서버 글')]).pages;
    if (serverPage == null) {
      throw new Error('서버 페이지가 없습니다');
    }
    const fetchServer = jest.fn(async () => serverPage);
    queryClient.setQueryData(QUERY_KEY, threadPages([createEditedThread('낙관적 글')]));
    const unsubscribe = new InfiniteQueryObserver(queryClient, {
      queryKey: QUERY_KEY,
      queryFn: fetchServer,
      initialPageParam: null,
      getNextPageParam: () => undefined,
      staleTime: Infinity,
    }).subscribe(noop);
    return { fetchServer, unsubscribe };
  }

  function readShownContent(queryClient: QueryClient) {
    return queryClient.getQueryData(QUERY_KEY)?.pages[0]?.items[0]?.comment.content;
  }

  /** 같은 할 일의 글 고치기 하나를 띄우고, 끝나면 응답을 `settleTodoCommentEdit`에 넘긴다 */
  function startEdit(
    queryClient: QueryClient,
    { startedWithOthers, response }: { startedWithOthers: boolean; response: string },
  ) {
    const pending = createPendingResponse(response);
    const running = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationKey: TODO_COMMENT_MUTATION_KEYS.updateComment({ todoId: TODO_ID }),
        mutationFn: () => pending.response,
        onSuccess: (content: string) =>
          settleTodoCommentEdit(queryClient, {
            todoId: TODO_ID,
            startedWithOthers,
            writeResponse: () =>
              patchTodoCommentCaches(queryClient, {
                todoId: TODO_ID,
                commentId: EDITED_ID,
                transform: (comment) => ({ ...comment, content }),
              }),
          }),
      })
      .execute(undefined);
    return async () => {
      pending.settle();
      await running;
    };
  }

  it('혼자 끝난 고치기는 응답을 쓰고 다시 받지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const { fetchServer, unsubscribe } = observeThreads(queryClient);
    const finish = startEdit(queryClient, { startedWithOthers: false, response: '응답 글' });

    // When
    await finish();

    // Then
    expect(readShownContent(queryClient)).toBe('응답 글');
    expect(fetchServer).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('겹친 두 고치기는 응답을 쓰지 않고, 먼저 끝난 응답은 낡음만 표시하고 마지막 고치기가 한 번 다시 받는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const { fetchServer, unsubscribe } = observeThreads(queryClient);
    const finishFirst = startEdit(queryClient, { startedWithOthers: false, response: '첫 응답' });
    const finishSecond = startEdit(queryClient, { startedWithOthers: true, response: '둘째 응답' });

    // When
    await finishSecond();
    const shownAfterEarlierResponse = readShownContent(queryClient);
    const isStaleAfterEarlierResponse = queryClient.getQueryState(QUERY_KEY)?.isInvalidated;
    const fetchesAfterEarlierResponse = fetchServer.mock.calls.length;
    await finishFirst();

    // Then
    expect(shownAfterEarlierResponse).toBe('낙관적 글');
    expect(isStaleAfterEarlierResponse).toBe(true);
    expect(fetchesAfterEarlierResponse).toBe(0);
    expect(fetchServer).toHaveBeenCalledTimes(1);
    expect(readShownContent(queryClient)).toBe('서버 글');
    unsubscribe();
  });

  it('보지 않는 정렬 목록에 남은 낡음 표시는 겹침으로 읽지 않아 응답을 쓴다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const { fetchServer, unsubscribe } = observeThreads(queryClient);
    queryClient.setQueryData(POPULAR_KEY, threadPages([createEditedThread('낙관적 글')]));
    await queryClient.invalidateQueries({ queryKey: POPULAR_KEY, refetchType: 'none' });
    const finish = startEdit(queryClient, { startedWithOthers: false, response: '응답 글' });

    // When
    await finish();

    // Then
    expect(readShownContent(queryClient)).toBe('응답 글');
    expect(fetchServer).not.toHaveBeenCalled();
    unsubscribe();
  });
});
