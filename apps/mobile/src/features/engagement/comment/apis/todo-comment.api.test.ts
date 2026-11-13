import { ApiError } from '@src/core/errors/api-error';
import { err } from '@src/core/errors/result';
import { createHttpClientStub } from '@src/testing/core';

import { TodoCommentApi } from './todo-comment.api';

const COMMENT_ID = 'cm12345678901234567890123';
const REPLY_ID = 'cm22345678901234567890123';

function createV2Dto(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT_ID,
    todoId: 42,
    threadCommentId: null,
    replyTo: null,
    author: {
      id: 'cm32345678901234567890123',
      name: '김철수',
      userTag: null,
      profileImage: null,
      isTodoOwner: true,
    },
    content: '함께 해요',
    likeCount: 0,
    replyCount: 0,
    isDeleted: false,
    isAuthorBlocked: false,
    isEdited: false,
    viewer: {
      isLiked: false,
      canEdit: true,
      canDelete: true,
      canReply: true,
      canReport: false,
      canBlock: false,
    },
    createdAt: '2026-08-26T00:00:00.000Z',
    editedAt: null,
    ...overrides,
  };
}

const PAGINATION = {
  previousCursor: null,
  nextCursor: null,
  hasPrevious: false,
  hasNext: false,
  size: 30,
};

describe('TodoCommentApi', () => {
  it('묶음 목록은 v2 endpoint에서 anchor와 함께 읽고 signal을 넘긴다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const service = new TodoCommentApi(httpClient);
    const signal = new AbortController().signal;
    httpClient.get.mockResolvedValue({
      ok: true,
      value: {
        items: [
          {
            comment: createV2Dto(),
            previewReply: null,
            replySummary: { totalCount: 0, hiddenCount: 0, participantAuthors: [] },
          },
        ],
        pagination: PAGINATION,
        anchor: null,
      },
    });
    const query = { sort: 'LATEST' as const, size: 30, anchorCommentId: COMMENT_ID };

    // When
    const result = await service.getThreads(42, query, signal);

    // Then
    expect(httpClient.get).toHaveBeenCalledWith('v2/todos/42/comments', { params: query, signal });
    expect(result.ok && result.value.items[0]?.comment.createdAt).toBe('2026-08-26T00:00:00.000Z');
  });

  it('답글은 묶음 머리의 replies endpoint에서 cursor를 그대로 보낸다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const service = new TodoCommentApi(httpClient);
    httpClient.get.mockResolvedValue({
      ok: true,
      value: {
        items: [createV2Dto({ id: REPLY_ID, threadCommentId: COMMENT_ID })],
        pagination: PAGINATION,
      },
    });

    // When
    const result = await service.getReplies(42, COMMENT_ID, { size: 10, cursor: 'opaque' });

    // Then
    expect(httpClient.get).toHaveBeenCalledWith(`v2/todos/42/comments/${COMMENT_ID}/replies`, {
      params: { size: 10, cursor: 'opaque' },
      signal: undefined,
    });
    expect(result.ok && result.value.items[0]?.threadCommentId).toBe(COMMENT_ID);
  });

  it('이미 지운 글처럼 예측한 4xx는 Result 오류로 그대로 넘긴다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const service = new TodoCommentApi(httpClient);
    const apiError = new ApiError('TODO_0833', '삭제된 댓글', 409);
    httpClient.put.mockResolvedValue(err(apiError));

    // When
    const result = await service.setCommentLike(42, COMMENT_ID, true);

    // Then
    expect(httpClient.put).toHaveBeenCalledWith(`v1/todos/42/comments/${COMMENT_ID}/likes`);
    expect(result).toEqual(err(apiError));
  });

  it('답글 쓰기는 v1 POST에 답할 글 id를 parentId로 보낸다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const service = new TodoCommentApi(httpClient);
    const input = {
      parentId: REPLY_ID,
      items: [{ clientRequestId: 'f43a3111-dc5e-4c62-b584-03b7c49124da', content: '답글' }],
    };
    httpClient.post.mockResolvedValue({
      ok: true,
      value: {
        comments: [
          {
            id: 'cm42345678901234567890123',
            threadId: COMMENT_ID,
            parentId: COMMENT_ID,
            depth: 1,
            author: null,
            content: '답글',
            isDeleted: false,
            isEdited: false,
            likeCount: 0,
            replyCount: 0,
            replyTo: { commentId: REPLY_ID, authorName: null },
            isAuthorBlocked: false,
            viewer: {
              isLiked: false,
              canEdit: true,
              canDelete: true,
              canReply: true,
              canReport: false,
              canBlock: false,
            },
            createdAt: '2026-08-26T00:00:00.000Z',
            editedAt: null,
          },
        ],
      },
    });

    // When
    const result = await service.createCommentChain(42, input);

    // Then
    expect(httpClient.post).toHaveBeenCalledWith('v1/todos/42/comments', input);
    expect(result.ok && result.value.comments[0]?.threadCommentId).toBe(COMMENT_ID);
  });
});
