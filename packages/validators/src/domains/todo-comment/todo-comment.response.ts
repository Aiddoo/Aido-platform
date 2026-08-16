import { z } from 'zod';

import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';
import { todoSchema } from '../todo/todo.response';

export const todoCommentAuthorSchema = z.object({
  id: z.cuid(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  isTodoOwner: z.boolean(),
});

export const todoCommentReplyTargetSchema = z.object({
  commentId: z.cuid(),
  authorName: z.string().nullable(),
});

export const todoCommentViewerSchema = z.object({
  isLiked: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canReply: z.boolean(),
});

/**
 * 댓글 한 건. 최상위 댓글과 답글은 같은 모양이고, parentId가 있느냐로만 갈린다.
 * 깊이 상한은 없다 — 화면이 들여쓰기를 접을 뿐이다.
 */
const todoCommentBaseSchema = z.object({
  id: z.cuid(),
  todoId: z.number().int().positive(),
  /** 직계 부모. null이면 최상위 댓글 */
  parentId: z.cuid().nullable(),
  /** 대화의 뿌리. 최상위 댓글이면 null */
  rootId: z.cuid().nullable(),
  /** 뿌리에서 이 댓글까지의 깊이 (최상위는 0) */
  depth: z.number().int().nonnegative(),
  author: todoCommentAuthorSchema.nullable(),
  content: z.string().nullable(),
  isDeleted: z.boolean(),
  isEdited: z.boolean(),
  likeCount: z.number().int().nonnegative(),
  /** 직계 답글 수 (자손 총합이 아니다) */
  replyCount: z.number().int().nonnegative(),
  /** 답글이 하나라도 있는지 — 클라이언트가 다음 화면으로 이어갈 근거 */
  hasReplies: z.boolean(),
  /** 미리보기 밖에 답글이 더 남았는지 — 클라이언트가 재계산하지 않도록 서버가 확정한다 */
  hasMoreReplies: z.boolean(),
  /** 누구에게 단 답글인지 — @멘션의 근거 */
  replyTo: todoCommentReplyTargetSchema.nullable(),
  viewer: todoCommentViewerSchema,
  createdAt: datetimeSchema,
  editedAt: nullableDatetimeSchema,
});

/**
 * 목록에 함께 실려 오는 답글 한 겹.
 * 자기 답글은 개수(replyCount)로만 알린다 — 서버가 미리보기를 한 겹까지만 채우기 때문이다.
 */
export const todoCommentPreviewSchema = todoCommentBaseSchema;

/** 목록의 댓글. 자식 미리보기를 함께 싣는다. */
export const todoCommentSchema = todoCommentBaseSchema.extend({
  /** 최신 답글 미리보기 (최대 TODO_COMMENT_LIMITS.REPLY_PREVIEW_SIZE건) */
  replyPreview: z.array(todoCommentPreviewSchema),
});

/** 커서 페이지네이션 메타. */
const cursorPaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasNext: z.boolean(),
  size: z.number().int().positive(),
});

/** 최상위 목록이든 어떤 댓글의 답글 목록이든 같은 모양이다. */
export const paginatedTodoCommentsSchema = z.object({
  items: z.array(todoCommentSchema),
  pagination: cursorPaginationSchema,
});

export const todoDetailsResponseSchema = z.object({
  todo: todoSchema,
  owner: todoCommentAuthorSchema.omit({ isTodoOwner: true }),
  permissions: z.object({
    canEdit: z.boolean(),
    canComment: z.boolean(),
    canNudge: z.boolean(),
  }),
  metrics: z.object({
    viewCount: z.number().int().nonnegative(),
    commentCount: z.number().int().nonnegative(),
  }),
});

/**
 * 스레드 화면의 머리말. 정렬과 무관한 값만 담아 정렬을 바꿔도 다시 받지 않는다.
 * 답글 목록은 GET /comments/{commentId}/replies가 따로 맡는다.
 */
export const todoCommentThreadResponseSchema = z.object({
  /** 뿌리 → 부모 순서의 조상들 (지금 보는 댓글이 최상위면 빈 배열) */
  ancestors: z.array(todoCommentPreviewSchema),
  /** 지금 보고 있는 댓글 */
  comment: todoCommentSchema,
});

/**
 * 작성 응답 — 한 번에 이어 쓴 사슬 전체를 위에서 아래 순서로 돌려준다.
 * 한 개만 썼으면 길이 1이다.
 */
export const todoCommentChainResponseSchema = z.object({
  comments: z.array(todoCommentSchema),
});

/** 수정 응답. 최상위와 답글이 같은 모양이라 분기가 없다. */
export const todoCommentMutationResponseSchema = z.object({
  comment: todoCommentSchema,
});

export const todoCommentLikeResponseSchema = z.object({
  commentId: z.cuid(),
  isLiked: z.boolean(),
  likeCount: z.number().int().nonnegative(),
});

export const deleteTodoCommentResponseSchema = z.object({
  commentId: z.cuid(),
  isDeleted: z.literal(true),
});

export type TodoComment = z.infer<typeof todoCommentSchema>;
export type TodoCommentPreview = z.infer<typeof todoCommentPreviewSchema>;
export type TodoCommentAuthor = z.infer<typeof todoCommentAuthorSchema>;
export type TodoCommentReplyTarget = z.infer<typeof todoCommentReplyTargetSchema>;
export type PaginatedTodoComments = z.infer<typeof paginatedTodoCommentsSchema>;
export type TodoDetailsResponse = z.infer<typeof todoDetailsResponseSchema>;
export type TodoCommentChainResponse = z.infer<typeof todoCommentChainResponseSchema>;
export type TodoCommentMutationResponse = z.infer<typeof todoCommentMutationResponseSchema>;
export type TodoCommentLikeResponse = z.infer<typeof todoCommentLikeResponseSchema>;
export type DeleteTodoCommentResponse = z.infer<typeof deleteTodoCommentResponseSchema>;
export type TodoCommentThreadResponse = z.infer<typeof todoCommentThreadResponseSchema>;
