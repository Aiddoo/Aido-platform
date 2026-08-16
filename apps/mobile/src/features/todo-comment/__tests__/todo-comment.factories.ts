import type {
  PendingTodoComment,
  TodoComment,
  TodoCommentPreview,
} from '../models/todo-comment.model';

const CREATED_AT = new Date('2026-08-15T09:00:00.000Z');

/** 할 일에 바로 달린 최상위 댓글 (depth 0). */
export const createTodoComment = (overrides?: Partial<TodoComment>): TodoComment => ({
  id: 'comment-1',
  todoId: 1,
  parentId: null,
  rootId: null,
  depth: 0,
  author: {
    id: 'user-1',
    name: '김철수',
    profileImage: null,
    isTodoOwner: true,
  },
  content: '오늘 운동 완료!',
  isDeleted: false,
  isEdited: false,
  likeCount: 0,
  replyCount: 0,
  hasReplies: false,
  hasMoreReplies: false,
  replyTo: null,
  viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
  createdAt: CREATED_AT,
  editedAt: null,
  replyPreview: [],
  ...overrides,
});

/**
 * 어떤 댓글 아래에 달린 답글. 부모를 넘기면 자리(parentId·rootId·depth)와
 * @멘션이 부모로부터 따라온다 — 깊이는 얼마든 이어 붙일 수 있다.
 */
export const createTodoCommentReply = (
  parent: TodoCommentPreview,
  overrides?: Partial<TodoComment>,
): TodoComment =>
  createTodoComment({
    id: `${parent.id}-reply`,
    todoId: parent.todoId,
    parentId: parent.id,
    rootId: parent.rootId ?? parent.id,
    depth: parent.depth + 1,
    author: {
      id: 'user-2',
      name: '이영희',
      profileImage: null,
      isTodoOwner: false,
    },
    content: '저도 같이 해요',
    replyTo: { commentId: parent.id, authorName: parent.author?.name ?? null },
    viewer: { isLiked: false, canEdit: false, canDelete: false, canReply: true },
    ...overrides,
  });

/** 서버가 아직 확인하지 않은 댓글 (낙관적 삽입 직후의 모습) */
export const createPendingTodoComment = (
  overrides?: Partial<TodoComment>,
): PendingTodoComment<TodoComment> => ({
  ...createTodoComment({
    viewer: { isLiked: false, canEdit: false, canDelete: false, canReply: false },
    ...overrides,
  }),
  isPending: true,
});
