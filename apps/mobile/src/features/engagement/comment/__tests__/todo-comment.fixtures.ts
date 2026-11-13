import {
  type TodoComment,
  type TodoCommentThread,
  todoCommentSchema,
  todoCommentThreadSchema,
} from '../domains/todo-comment.model';

const CREATED_AT = '2026-08-15T09:00:00.000Z';
export const TODO_ID = 42;

export function createTodoComment(overrides?: Partial<TodoComment>): TodoComment {
  return todoCommentSchema.parse({
    id: 'comment-1',
    todoId: TODO_ID,
    threadCommentId: null,
    replyTo: null,
    author: {
      id: 'user-1',
      name: '김철수',
      userTag: 'WNTQJEEE',
      profileImage: null,
      isTodoOwner: true,
    },
    content: '오늘 운동 완료!',
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
    createdAt: CREATED_AT,
    editedAt: null,
    ...overrides,
  });
}

export function createTodoCommentReply(
  head: TodoComment,
  overrides?: Partial<TodoComment>,
): TodoComment {
  return createTodoComment({
    id: `${head.id}-reply`,
    threadCommentId: head.id,
    author: {
      id: 'user-2',
      name: '이영희',
      userTag: '2DX97AMT',
      profileImage: null,
      isTodoOwner: false,
    },
    content: '저도 같이 해요',
    replyTo: { commentId: head.id, authorName: head.author?.name ?? null },
    viewer: {
      isLiked: false,
      canEdit: false,
      canDelete: false,
      canReply: true,
      canReport: true,
      canBlock: true,
    },
    ...overrides,
  });
}

export function createTodoCommentThread(overrides?: Partial<TodoCommentThread>): TodoCommentThread {
  const comment = overrides?.comment ?? createTodoComment({ replyCount: 1 });
  const previewReply =
    // oxlint-disable-next-line aido/no-strict-nullish -- null은 대표 답글이 없는 묶음, undefined는 기본 대표 답글이다
    overrides?.previewReply === undefined
      ? createTodoCommentReply(comment)
      : overrides.previewReply;

  return todoCommentThreadSchema.parse({
    comment,
    previewReply,
    replySummary: {
      totalCount: comment.replyCount,
      hiddenCount: Math.max(0, comment.replyCount - (previewReply == null ? 0 : 1)),
      participantAuthors: [],
    },
    ...overrides,
  });
}
