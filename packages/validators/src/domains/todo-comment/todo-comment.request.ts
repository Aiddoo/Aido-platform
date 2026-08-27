import { z } from 'zod';

import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from './todo-comment.constants';

export const todoCommentIdSchema = z.cuid('댓글 ID를 확인해주세요.').describe('댓글 ID (CUID)');

export const todoCommentIdParamSchema = z
  .object({
    todoId: z.coerce
      .number({ error: '할 일 ID를 확인해주세요.' })
      .int('할 일 ID를 확인해주세요.')
      .positive('할 일 ID를 확인해주세요.')
      .describe('할 일 ID (양의 정수)'),
    commentId: todoCommentIdSchema.describe('댓글 ID (CUID)'),
  })
  .describe('할 일 댓글 경로 파라미터');

export const todoDetailsParamSchema = z
  .object({
    todoId: z.coerce
      .number({ error: '할 일 ID를 확인해주세요.' })
      .int('할 일 ID를 확인해주세요.')
      .positive('할 일 ID를 확인해주세요.')
      .describe('할 일 ID (양의 정수)'),
  })
  .describe('할 일 상세 경로 파라미터');

export const todoCommentContentSchema = z
  .string()
  .trim()
  .min(1, '댓글 내용을 입력해주세요.')
  .max(
    TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH,
    `댓글은 ${TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH}자 이내로 입력해주세요.`,
  )
  .describe(`댓글 내용 (1~${TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH}자)`);

const todoCommentChainItemSchema = z
  .object({
    clientRequestId: z
      .uuid('댓글 요청 ID를 확인해주세요.')
      .describe('댓글 작성 멱등 요청 ID (UUID)'),
    content: todoCommentContentSchema,
  })
  .describe('이어 쓰기 댓글 한 건');

/**
 * 한 번에 이어 쓰는 글 묶음.
 * 첫 글만 대상(할 일 또는 댓글)의 직계 자식이고, 나머지는 바로 앞 글의 답글로 이어진다.
 * 멱등 키를 글마다 받아 재시도해도 사슬이 두 번 생기지 않는다.
 */
export const createTodoCommentChainSchema = z
  .object({
    parentId: todoCommentIdSchema.nullable().default(null),
    items: z
      .array(todoCommentChainItemSchema)
      .min(1, '댓글을 한 개 이상 입력해주세요.')
      .max(
        TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE,
        `댓글은 한 번에 ${TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE}개까지 이어 쓸 수 있습니다.`,
      )
      .describe(`이어 쓸 댓글 목록 (1~${TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE}개)`),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();

    value.items.forEach((item, index) => {
      if (seen.has(item.clientRequestId)) {
        context.addIssue({
          code: 'custom',
          message: '댓글 요청 ID는 한 요청 안에서 중복될 수 없습니다.',
          path: ['items', index, 'clientRequestId'],
        });
        return;
      }

      seen.add(item.clientRequestId);
    });
  })
  .describe('할 일 댓글 이어 쓰기 요청');

export const updateTodoCommentSchema = z
  .object({
    content: todoCommentContentSchema,
  })
  .describe('할 일 댓글 수정 요청');

const todoCommentSortSchema = z
  .enum(TODO_COMMENT_SORT)
  .optional()
  .default(TODO_COMMENT_SORT.LATEST)
  .describe('댓글 정렬 (LATEST: 최신순, POPULAR: 인기순)');

const todoCommentPageSizeSchema = z.coerce
  .number()
  .int('댓글 조회 개수를 확인해주세요.')
  .min(1, '댓글을 한 개 이상 조회해주세요.')
  .max(
    TODO_COMMENT_LIMITS.MAX_PAGE_SIZE,
    `댓글은 한 번에 ${TODO_COMMENT_LIMITS.MAX_PAGE_SIZE}개까지 조회할 수 있습니다.`,
  )
  .optional()
  .default(TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE)
  .describe(
    `댓글 조회 개수 (기본 ${TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE}, 최대 ${TODO_COMMENT_LIMITS.MAX_PAGE_SIZE})`,
  );

const todoCommentCursorSchema = z
  .string()
  .min(1, '댓글 위치를 확인해주세요.')
  .describe('댓글 페이지 위치 커서');

export const getTodoCommentOverviewQuerySchema = z
  .object({
    sort: todoCommentSortSchema,
    before: todoCommentCursorSchema.optional(),
    after: todoCommentCursorSchema.optional(),
    size: todoCommentPageSizeSchema,
  })
  .superRefine((value, context) => {
    if (value.before !== undefined && value.after !== undefined) {
      context.addIssue({
        code: 'custom',
        message: '댓글 개요 위치는 before, after 중 하나만 지정할 수 있습니다.',
        path: ['before'],
      });
    }
  })
  .describe('할 일 댓글 개요 조회 쿼리');

/**
 * 대화 페이지의 진입점은 하나뿐이다. focus는 알림 deep link, before/after는 양방향 페이지 이동이다.
 * 서로 섞으면 어느 위치를 기준으로 삼아야 하는지 모호해지므로 최대 하나만 받는다.
 */
export const getTodoConversationQuerySchema = z
  .object({
    sort: todoCommentSortSchema,
    focusCommentId: todoCommentIdSchema.optional(),
    before: todoCommentCursorSchema.optional(),
    after: todoCommentCursorSchema.optional(),
    size: todoCommentPageSizeSchema,
  })
  .superRefine((value, context) => {
    const positions = [value.focusCommentId, value.before, value.after].filter(
      (position) => position !== undefined,
    );

    if (positions.length > 1) {
      context.addIssue({
        code: 'custom',
        message: '대화 위치는 focusCommentId, before, after 중 하나만 지정할 수 있습니다.',
        path: ['focusCommentId'],
      });
    }
  })
  .describe('할 일 댓글 대화 조회 쿼리');

export type CreateTodoCommentChainInput = z.infer<typeof createTodoCommentChainSchema>;
export type UpdateTodoCommentInput = z.infer<typeof updateTodoCommentSchema>;
export type GetTodoCommentOverviewQuery = z.infer<typeof getTodoCommentOverviewQuerySchema>;
export type GetTodoConversationQuery = z.infer<typeof getTodoConversationQuerySchema>;
