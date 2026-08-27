import { createTodoComment, createTodoCommentReply } from '../../__tests__/todo-comment.factories';
import type {
  TodoComment,
  TodoConversationConnection,
  TodoConversationItem,
  TodoConversationPage,
} from '../../models/todo-comment.model';
import { toTodoCommentConversationViewModel } from './todo-comment-conversation.view-model';

function createConnection(depth: number): TodoConversationConnection {
  return {
    visualDepth: depth,
    upperLaneDepths: depth === 0 ? [] : [depth - 1],
    lowerLaneDepths: [],
    incomingBranch: depth === 0 ? null : { fromDepth: depth - 1, toDepth: depth },
  };
}

function createItem(
  comment: TodoComment,
  overrides: Partial<TodoConversationItem> = {},
): TodoConversationItem {
  return {
    comment,
    connection: createConnection(comment.depth),
    isFocused: false,
    ...overrides,
  };
}

function createPage(
  items: TodoConversationItem[],
  overrides: Partial<TodoConversationPage> = {},
): TodoConversationPage {
  return {
    items,
    focus: null,
    pagination: {
      previousCursor: null,
      nextCursor: null,
      hasPrevious: false,
      hasNext: false,
      size: 20,
    },
    ...overrides,
  };
}

describe('toTodoCommentConversationViewModel', () => {
  it('인접 행으로 다시 계산하지 않고 서버의 연결 상태를 그대로 전달한다', () => {
    // Given
    const root = createTodoComment();
    const reply = createTodoCommentReply(root);
    const items = [
      createItem(root, {
        connection: {
          visualDepth: 0,
          upperLaneDepths: [],
          lowerLaneDepths: [0],
          incomingBranch: null,
        },
      }),
      createItem(reply, {
        connection: {
          visualDepth: 1,
          upperLaneDepths: [0],
          lowerLaneDepths: [1],
          incomingBranch: { fromDepth: 0, toDepth: 1 },
        },
      }),
    ];

    // When
    const result = toTodoCommentConversationViewModel([createPage(items)]);

    // Then
    expect(result.rows).toMatchObject([
      {
        connection: {
          visualDepth: 0,
          upperLaneDepths: [],
          lowerLaneDepths: [0],
          incomingBranch: null,
        },
      },
      {
        connection: {
          visualDepth: 1,
          upperLaneDepths: [0],
          lowerLaneDepths: [1],
          incomingBranch: { fromDepth: 0, toDepth: 1 },
        },
      },
    ]);
  });

  it('페이지 중복을 제거하고 서버가 표시한 focus 행만 유지한다', () => {
    // Given
    const root = createTodoComment();
    const first = createPage([createItem(root, { isFocused: true })], {
      focus: {
        commentId: root.id,
        itemIndex: 0,
        precedingAncestors: [],
        omittedAncestorCount: 0,
      },
    });
    const second = createPage([createItem(root)]);

    // When
    const result = toTodoCommentConversationViewModel([first, second]);

    // Then
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.isFocused).toBe(true);
  });

  it('focus 조상 snapshot은 일반 row에 섞지 않고 직계 부모 문맥으로만 쓴다', () => {
    // Given
    const root = createTodoComment({ id: 'root' });
    const parent = createTodoCommentReply(root, { id: 'parent' });
    const focused = createTodoCommentReply(parent, { id: 'focused' });
    const parentItem = createItem(parent);
    const page = createPage([createItem(focused, { isFocused: true })], {
      focus: {
        commentId: focused.id,
        itemIndex: 0,
        precedingAncestors: [createItem(root), parentItem],
        omittedAncestorCount: 2,
      },
    });

    // When
    const result = toTodoCommentConversationViewModel([page]);

    // Then
    expect(result.rows.map((row) => row.comment.id)).toEqual([focused.id]);
    expect(result.rows[0]?.focusContext).toEqual({
      parent,
      connection: parentItem.connection,
      earlierAncestorCount: 3,
    });
  });

  it('직계 부모가 일반 row에 있으면 focus 문맥을 중복해서 붙이지 않는다', () => {
    // Given
    const root = createTodoComment({ id: 'root' });
    const focused = createTodoCommentReply(root, { id: 'focused' });
    const page = createPage([createItem(root), createItem(focused, { isFocused: true })], {
      focus: {
        commentId: focused.id,
        itemIndex: 1,
        precedingAncestors: [createItem(root)],
        omittedAncestorCount: 0,
      },
    });

    // When
    const result = toTodoCommentConversationViewModel([page]);

    // Then
    expect(result.rows[1]?.focusContext).toBeNull();
  });

  it('마지막 조상 snapshot이 직계 부모와 다르면 문맥을 만들지 않는다', () => {
    // Given
    const parent = createTodoComment({ id: 'parent' });
    const focused = createTodoCommentReply(parent, { id: 'focused' });
    const unrelated = createTodoComment({ id: 'unrelated' });
    const page = createPage([createItem(focused, { isFocused: true })], {
      focus: {
        commentId: focused.id,
        itemIndex: 0,
        precedingAncestors: [createItem(unrelated)],
        omittedAncestorCount: 0,
      },
    });

    // When
    const result = toTodoCommentConversationViewModel([page]);

    // Then
    expect(result.rows[0]?.focusContext).toBeNull();
  });
});
