import { TODO_COMMENT_SORT } from '@aido/validators';
import { createMockHttpClient } from '@src/shared/__tests__/create-mock-http-client';
import { ParseError } from '@src/shared/errors/infra-error';

import { TodoCommentService } from './todo-comment.service';

const COMMENT_ID = 'cm12345678901234567890123';
const THREAD_ID = 'cm22345678901234567890123';

function createCommentDto() {
  return {
    id: COMMENT_ID,
    threadId: THREAD_ID,
    parentId: null,
    depth: 0,
    author: {
      id: 'cm32345678901234567890123',
      name: '김철수',
      profileImage: null,
      isTodoOwner: true,
    },
    content: '함께 해요',
    isDeleted: false,
    isEdited: false,
    likeCount: 0,
    replyCount: 0,
    replyTo: null,
    viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
    createdAt: '2026-08-26T00:00:00.000Z',
    editedAt: null,
  };
}

function createConversationItemDto() {
  return {
    comment: createCommentDto(),
    connection: {
      visualDepth: 0,
      upperLaneDepths: [],
      lowerLaneDepths: [0],
      incomingBranch: null,
    },
    isFocused: true,
  };
}

describe('TodoCommentService', () => {
  test('최상위 댓글 개요는 실제 overview endpoint에서 조회한다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    const service = new TodoCommentService(httpClient);
    const signal = new AbortController().signal;
    httpClient.get.mockResolvedValue({
      ok: true,
      value: {
        items: [
          {
            comment: createCommentDto(),
            previewReply: null,
            replySummary: {
              totalCount: 2,
              hiddenCount: 2,
              hasMore: true,
              participantAuthors: [createCommentDto().author],
            },
          },
        ],
        pagination: {
          previousCursor: null,
          nextCursor: 'after',
          hasPrevious: false,
          hasNext: true,
          size: 20,
        },
      },
    });

    // When
    const result = await service.getOverview(
      42,
      { sort: TODO_COMMENT_SORT.LATEST, size: 20 },
      signal,
    );

    // Then
    expect(httpClient.get).toHaveBeenCalledWith('v1/todos/42/comments/overview', {
      params: { sort: TODO_COMMENT_SORT.LATEST, size: 20 },
      signal,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items[0]?.comment.createdAt).toEqual(
        new Date('2026-08-26T00:00:00.000Z'),
      );
      expect(result.value.items[0]?.replySummary.hiddenCount).toBe(2);
    }
  });

  test('개요 응답이 계약과 다르면 ParseError를 던진다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    const service = new TodoCommentService(httpClient);
    httpClient.get.mockResolvedValue({ ok: true, value: { items: [] } });

    // When & Then
    await expect(
      service.getOverview(42, { sort: TODO_COMMENT_SORT.LATEST, size: 20 }),
    ).rejects.toBeInstanceOf(ParseError);
  });

  test('focus와 양방향 cursor는 하나의 conversation endpoint로 보낸다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    const service = new TodoCommentService(httpClient);
    const signal = new AbortController().signal;
    httpClient.get.mockResolvedValue({
      ok: true,
      value: {
        items: [createConversationItemDto()],
        focus: {
          commentId: COMMENT_ID,
          itemIndex: 0,
          precedingAncestors: [],
          omittedAncestorCount: 0,
        },
        pagination: {
          previousCursor: 'before',
          nextCursor: 'after',
          hasPrevious: true,
          hasNext: true,
          size: 20,
        },
      },
    });

    // When
    const result = await service.getConversation(
      42,
      { sort: TODO_COMMENT_SORT.LATEST, focusCommentId: COMMENT_ID, size: 20 },
      signal,
    );

    // Then
    expect(httpClient.get).toHaveBeenCalledWith('v1/todos/42/conversation', {
      params: { sort: TODO_COMMENT_SORT.LATEST, focusCommentId: COMMENT_ID, size: 20 },
      signal,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items[0]?.comment.createdAt).toEqual(
        new Date('2026-08-26T00:00:00.000Z'),
      );
      expect(result.value.items[0]?.connection).toEqual({
        visualDepth: 0,
        upperLaneDepths: [],
        lowerLaneDepths: [0],
        incomingBranch: null,
      });
      expect(result.value.focus?.commentId).toBe(COMMENT_ID);
    }
  });

  test('정렬·중복 계약을 어긴 conversation lane은 ParseError로 거부한다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    const service = new TodoCommentService(httpClient);
    httpClient.get.mockResolvedValue({
      ok: true,
      value: {
        items: [
          {
            ...createConversationItemDto(),
            connection: {
              visualDepth: 2,
              upperLaneDepths: [1, 0],
              lowerLaneDepths: [],
              incomingBranch: { fromDepth: 1, toDepth: 2 },
            },
          },
        ],
        focus: null,
        pagination: {
          previousCursor: null,
          nextCursor: null,
          hasPrevious: false,
          hasNext: false,
          size: 20,
        },
      },
    });

    // When & Then
    await expect(
      service.getConversation(42, { sort: TODO_COMMENT_SORT.LATEST, size: 20 }),
    ).rejects.toBeInstanceOf(ParseError);
  });

  test('최상위와 답글을 같은 POST body의 nullable parentId로 보낸다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    const service = new TodoCommentService(httpClient);
    const input = {
      parentId: COMMENT_ID,
      items: [{ clientRequestId: 'f43a3111-dc5e-4c62-b584-03b7c49124da', content: '답글' }],
    };
    httpClient.post.mockResolvedValue({
      ok: true,
      value: { comments: [createCommentDto()] },
    });

    // When
    await service.createCommentChain(42, input);

    // Then
    expect(httpClient.post).toHaveBeenCalledWith('v1/todos/42/comments', input);
  });
});
