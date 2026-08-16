import { z } from 'zod';

import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from './todo-comment.constants';

export const todoCommentIdSchema = z.cuid().describe('댓글 ID (CUID)');

export const todoCommentIdParamSchema = z.object({
  todoId: z.coerce.number().int().positive(),
  commentId: todoCommentIdSchema,
});

export const todoDetailsParamSchema = z.object({
  todoId: z.coerce.number().int().positive(),
});

export const todoCommentContentSchema = z
  .string()
  .trim()
  .min(1, '댓글 내용을 입력해주세요.')
  .max(
    TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH,
    `댓글은 ${TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH}자 이내로 입력해주세요.`,
  );

/**
 * 한 번에 이어 쓰는 글 묶음.
 * 첫 글만 대상(할 일 또는 댓글)의 직계 자식이고, 나머지는 바로 앞 글의 답글로 이어진다.
 * 멱등 키를 글마다 받아 재시도해도 사슬이 두 번 생기지 않는다.
 */
export const createTodoCommentChainSchema = z.object({
  items: z
    .array(
      z.object({
        clientRequestId: z.uuid(),
        content: todoCommentContentSchema,
      }),
    )
    .min(1)
    .max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE),
});

export const updateTodoCommentSchema = z.object({
  content: todoCommentContentSchema,
});

/** 기본은 최신순 — 쓰레드도 답글을 시간순으로만 세운다(인기순 개념이 없다). */
const todoCommentSortSchema = z
  .enum(TODO_COMMENT_SORT)
  .optional()
  .default(TODO_COMMENT_SORT.LATEST);

const todoCommentPageSizeSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(TODO_COMMENT_LIMITS.MAX_PAGE_SIZE)
  .optional()
  .default(TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE);

/** 최상위 댓글 목록과 어떤 댓글의 답글 목록이 같은 계약을 쓴다. */
export const getTodoCommentsQuerySchema = z.object({
  sort: todoCommentSortSchema,
  cursor: z.string().min(1).optional(),
  size: todoCommentPageSizeSchema,
});

export type CreateTodoCommentChainInput = z.infer<typeof createTodoCommentChainSchema>;
export type UpdateTodoCommentInput = z.infer<typeof updateTodoCommentSchema>;
export type GetTodoCommentsQuery = z.infer<typeof getTodoCommentsQuerySchema>;
