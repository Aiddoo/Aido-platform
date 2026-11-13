import {
  type TodoCommentV2,
  todoCommentThreadsResponseSchema,
  todoCommentV2Schema,
} from '@aido/api';

import { todoCommentSchema, todoCommentThreadPageSchema } from '../domains/todo-comment.model';
import { writtenTodoCommentMutationResponseSchema } from '../schemas/todo-comment-response.schema';
import {
  toRepliesQuery,
  toThreadsQuery,
  toWrittenTodoComment,
  toTodoCommentThreadPage,
} from './todo-comment.mapper';

const HEAD_ID = 'cm12345678901234567890123';
const REPLY_ID = 'cm22345678901234567890123';

/** 계약 스키마로 검증해 서버가 실제로 보낼 수 있는 모양만 fixture로 쓴다 */
function createV2Dto(overrides: Partial<TodoCommentV2> = {}): TodoCommentV2 {
  return todoCommentV2Schema.parse({
    id: HEAD_ID,
    todoId: 42,
    threadCommentId: null,
    replyTo: null,
    author: {
      id: 'cm32345678901234567890123',
      name: '김철수',
      userTag: 'WNTQJEEE',
      profileImage: null,
      isTodoOwner: true,
    },
    content: '오늘 운동 완료',
    likeCount: 0,
    replyCount: 1,
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
  });
}

describe('todo comment mapper', () => {
  it('묶음 페이지의 날짜만 Date로 바꾸고 서버 집계·anchor는 그대로 둔다', () => {
    // Given
    const dto = todoCommentThreadsResponseSchema.parse({
      items: [
        {
          comment: createV2Dto(),
          previewReply: createV2Dto({
            id: REPLY_ID,
            threadCommentId: HEAD_ID,
            replyCount: 0,
            editedAt: '2026-08-26T00:02:00.000Z',
          }),
          replySummary: { totalCount: 4, hiddenCount: 3, participantAuthors: [] },
        },
      ],
      pagination: {
        previousCursor: null,
        nextCursor: 'next',
        hasPrevious: false,
        hasNext: true,
        size: 30,
      },
      anchor: { threadCommentId: HEAD_ID, replyId: REPLY_ID },
    });

    // When
    const page = toTodoCommentThreadPage(dto);

    // Then
    expect(page.items[0]?.comment.createdAt).toBe('2026-08-26T00:00:00.000Z');
    expect(page.items[0]?.previewReply?.editedAt).toBe('2026-08-26T00:02:00.000Z');
    expect(page.items[0]?.replySummary).toEqual(dto.items[0]?.replySummary);
    expect(page.anchor).toEqual(dto.anchor);
  });

  it('계약을 통과한 묶음 페이지는 앱 댓글 모델도 통과한다', () => {
    // Given
    const dto = todoCommentThreadsResponseSchema.parse({
      items: [
        {
          comment: createV2Dto(),
          previewReply: null,
          replySummary: { totalCount: 0, hiddenCount: 0, participantAuthors: [] },
        },
      ],
      pagination: {
        previousCursor: null,
        nextCursor: null,
        hasPrevious: false,
        hasNext: false,
        size: 30,
      },
      anchor: null,
    });

    // When
    const page = toTodoCommentThreadPage(dto);

    // Then
    expect(todoCommentThreadPageSchema.parse(page)).toEqual(page);
    expect(todoCommentSchema.parse(page.items[0]?.comment)).toEqual(page.items[0]?.comment);
  });

  it('v1 쓰기 응답의 parentId를 묶음 머리로 읽는다', () => {
    // Given
    const { comment: dto } = writtenTodoCommentMutationResponseSchema.parse({
      comment: {
        id: REPLY_ID,
        threadId: HEAD_ID,
        parentId: HEAD_ID,
        depth: 1,
        author: {
          id: 'cm32345678901234567890123',
          name: '이영희',
          profileImage: null,
          isTodoOwner: false,
        },
        content: '저도요',
        isDeleted: false,
        isEdited: false,
        likeCount: 0,
        replyCount: 0,
        replyTo: { commentId: HEAD_ID, authorName: '김철수' },
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
    });

    // When
    const comment = toWrittenTodoComment(42, dto);

    // Then
    expect(comment).toMatchObject({
      todoId: 42,
      threadCommentId: HEAD_ID,
      isAuthorBlocked: false,
      author: { userTag: null },
      viewer: { canReport: false, canBlock: false },
    });
  });
});

describe('todo-comment 요청 값', () => {
  it('첫 페이지만 anchor로 위치를 찾고 이어지는 페이지는 cursor만 보낸다', () => {
    // When
    const first = toThreadsQuery(null, { sort: 'LATEST', anchorCommentId: HEAD_ID });
    const next = toThreadsQuery('cursor-1', { sort: 'LATEST', anchorCommentId: HEAD_ID });

    // Then
    expect(first).toEqual({ sort: 'LATEST', size: 30, anchorCommentId: HEAD_ID });
    expect(next).toEqual({ sort: 'LATEST', size: 30, cursor: 'cursor-1' });
  });

  it('답글은 10개씩 받고 알림으로 연 답글이 든 페이지부터 받는다', () => {
    // When
    const around = toRepliesQuery(null, { aroundReplyId: HEAD_ID });
    const plain = toRepliesQuery(null, { aroundReplyId: null });

    // Then
    expect(around).toEqual({ size: 10, aroundReplyId: HEAD_ID });
    expect(plain).toEqual({ size: 10 });
  });
});
