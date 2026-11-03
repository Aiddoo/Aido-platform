import type {
  TodoComment as TodoCommentV1Dto,
  TodoCommentThreadsResponse,
  TodoCommentV2,
} from '@aido/api';

import { toTodoCommentFromV1, toTodoCommentThreadPage } from './todo-comment.mapper';

const HEAD_ID = 'cm12345678901234567890123';
const REPLY_ID = 'cm22345678901234567890123';

function createV2Dto(overrides: Partial<TodoCommentV2> = {}): TodoCommentV2 {
  return {
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
  };
}

describe('todo comment mapper', () => {
  test('묶음 페이지의 날짜만 Date로 바꾸고 서버 집계·anchor는 그대로 둔다', () => {
    // Given
    const dto: TodoCommentThreadsResponse = {
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
    };

    // When
    const page = toTodoCommentThreadPage(dto);

    // Then
    expect(page.items[0]?.comment.createdAt).toEqual(new Date('2026-08-26T00:00:00.000Z'));
    expect(page.items[0]?.previewReply?.editedAt).toEqual(new Date('2026-08-26T00:02:00.000Z'));
    expect(page.items[0]?.replySummary).toEqual(dto.items[0]?.replySummary);
    expect(page.anchor).toEqual(dto.anchor);
  });

  test('v1 쓰기 응답의 parentId를 묶음 머리로, 빠진 1.13.0 필드는 할 수 없음으로 읽는다', () => {
    // Given
    const dto: TodoCommentV1Dto = {
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
      viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
      createdAt: '2026-08-26T00:00:00.000Z',
      editedAt: null,
    };

    // When
    const comment = toTodoCommentFromV1(42, dto);

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
