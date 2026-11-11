import {
  todoCommentChainResponseSchema,
  todoCommentMutationResponseSchema,
  todoCommentSchema,
  todoCommentViewerSchema,
} from '@aido/api';
import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { z } from 'zod';

/** 지금 서버는 쓰기 응답 댓글에도 차단 여부와 신고·차단 권한을 항상 싣는다 */
const writtenTodoCommentSchema = todoCommentSchema
  .required({ isAuthorBlocked: true })
  .extend({ viewer: todoCommentViewerSchema.required({ canReport: true, canBlock: true }) });
export type WrittenTodoCommentResponse = z.output<typeof writtenTodoCommentSchema>;

export const writtenTodoCommentChainResponseSchema = todoCommentChainResponseSchema.extend({
  comments: z.array(writtenTodoCommentSchema).min(1).max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE),
});
export type WrittenTodoCommentChainResponse = z.output<
  typeof writtenTodoCommentChainResponseSchema
>;

export const writtenTodoCommentMutationResponseSchema = todoCommentMutationResponseSchema.extend({
  comment: writtenTodoCommentSchema,
});
export type WrittenTodoCommentMutationResponse = z.output<
  typeof writtenTodoCommentMutationResponseSchema
>;
