import type {
  TodoComment as TodoCommentDto,
  TodoCommentOverviewResponse,
  TodoConversationItem as TodoConversationItemDto,
  TodoConversationResponse,
} from '@aido/validators';

import { toTodoCommentOverviewPage, toTodoConversationPage } from './todo-comment.mapper';

const ROOT_ID = 'cm12345678901234567890123';
const REPLY_ID = 'cm22345678901234567890123';

function createCommentDto(overrides: Partial<TodoCommentDto> = {}): TodoCommentDto {
  return {
    id: ROOT_ID,
    threadId: ROOT_ID,
    parentId: null,
    depth: 0,
    author: {
      id: 'cm32345678901234567890123',
      name: '김철수',
      profileImage: null,
      isTodoOwner: true,
    },
    content: '오늘 운동 완료',
    isDeleted: false,
    isEdited: false,
    likeCount: 0,
    replyCount: 1,
    replyTo: null,
    viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
    createdAt: '2026-08-26T00:00:00.000Z',
    editedAt: null,
    ...overrides,
  };
}

function createConversationItemDto(
  comment: TodoCommentDto,
  overrides: Partial<TodoConversationItemDto> = {},
): TodoConversationItemDto {
  return {
    comment,
    connection: {
      visualDepth: comment.depth,
      upperLaneDepths: comment.depth === 0 ? [] : [comment.depth - 1],
      lowerLaneDepths: [],
      incomingBranch:
        comment.depth === 0 ? null : { fromDepth: comment.depth - 1, toDepth: comment.depth },
    },
    isFocused: false,
    ...overrides,
  };
}

describe('todo comment mapper', () => {
  test('overview의 root와 대표 답글 날짜를 변환하고 서버 집계는 그대로 둔다', () => {
    // Given
    const root = createCommentDto();
    const previewReply = createCommentDto({
      id: REPLY_ID,
      parentId: ROOT_ID,
      depth: 1,
      createdAt: '2026-08-26T00:01:00.000Z',
    });
    const dto: TodoCommentOverviewResponse = {
      items: [
        {
          comment: root,
          previewReply,
          replySummary: {
            totalCount: 4,
            hiddenCount: 3,
            hasMore: true,
            participantAuthors: previewReply.author === null ? [] : [previewReply.author],
          },
        },
      ],
      pagination: {
        previousCursor: null,
        nextCursor: 'next-root',
        hasPrevious: false,
        hasNext: true,
        size: 20,
      },
    };

    // When
    const result = toTodoCommentOverviewPage(dto);

    // Then
    expect(result.items[0]?.comment.createdAt).toEqual(new Date(root.createdAt));
    expect(result.items[0]?.previewReply?.createdAt).toEqual(new Date(previewReply.createdAt));
    expect(result.items[0]?.replySummary).toEqual(dto.items[0]?.replySummary);
  });

  test('conversation과 focus 조상의 연결 상태를 다시 계산하지 않고 보존한다', () => {
    // Given
    const root = createCommentDto();
    const focused = createCommentDto({
      id: REPLY_ID,
      parentId: ROOT_ID,
      depth: 1,
    });
    const rootItem = createConversationItemDto(root, {
      connection: {
        visualDepth: 0,
        upperLaneDepths: [],
        lowerLaneDepths: [0],
        incomingBranch: null,
      },
    });
    const focusedItem = createConversationItemDto(focused, {
      connection: {
        visualDepth: 1,
        upperLaneDepths: [0],
        lowerLaneDepths: [],
        incomingBranch: { fromDepth: 0, toDepth: 1 },
      },
      isFocused: true,
    });
    const dto: TodoConversationResponse = {
      items: [focusedItem],
      focus: {
        commentId: focused.id,
        itemIndex: 0,
        precedingAncestors: [rootItem],
        omittedAncestorCount: 0,
      },
      pagination: {
        previousCursor: null,
        nextCursor: null,
        hasPrevious: false,
        hasNext: false,
        size: 20,
      },
    };

    // When
    const result = toTodoConversationPage(dto);

    // Then
    expect(result.items[0]?.connection).toEqual(focusedItem.connection);
    expect(result.items[0]?.isFocused).toBe(true);
    expect(result.focus?.precedingAncestors[0]?.connection).toEqual(rootItem.connection);
    expect(result.focus?.precedingAncestors[0]?.comment.createdAt).toEqual(
      new Date(root.createdAt),
    );
  });
});
