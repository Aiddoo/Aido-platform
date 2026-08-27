import type { TodoComment } from '../models/todo-comment.model';

const CREATED_AT = new Date('2026-08-15T09:00:00.000Z');

export const createTodoComment = (overrides?: Partial<TodoComment>): TodoComment => ({
  id: 'comment-1',
  threadId: 'comment-1',
  parentId: null,
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
  replyTo: null,
  viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
  createdAt: CREATED_AT,
  editedAt: null,
  ...overrides,
});

export const createTodoCommentReply = (
  parent: TodoComment,
  overrides?: Partial<TodoComment>,
): TodoComment =>
  createTodoComment({
    id: `${parent.id}-reply`,
    threadId: parent.threadId,
    parentId: parent.id,
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
