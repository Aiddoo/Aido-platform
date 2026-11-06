import {
  todoCommentCursorPaginationSchema,
  todoCommentLikeResponseSchema,
  todoCommentThreadAnchorSchema as todoCommentThreadAnchorContractSchema,
  todoCommentThreadSchema as todoCommentThreadContractSchema,
  todoCommentV2Schema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const todoCommentSchema = todoCommentV2Schema.extend({
  createdAt: instantSchema,
  editedAt: instantSchema.nullable(),
});
export type TodoComment = z.infer<typeof todoCommentSchema>;

export type TodoCommentAuthor = NonNullable<TodoComment['author']>;

const todoCommentThreadSchema = todoCommentThreadContractSchema.extend({
  comment: todoCommentSchema,
  previewReply: todoCommentSchema.nullable(),
});
export type TodoCommentThread = z.infer<typeof todoCommentThreadSchema>;

export type TodoCommentThreadAnchor = z.infer<typeof todoCommentThreadAnchorContractSchema>;

export type TodoCommentPagination = z.infer<typeof todoCommentCursorPaginationSchema>;

const todoCommentThreadPageSchema = z.object({
  items: z.array(todoCommentThreadSchema),
  pagination: todoCommentCursorPaginationSchema,
  anchor: todoCommentThreadAnchorContractSchema.nullable(),
});
export type TodoCommentThreadPage = z.infer<typeof todoCommentThreadPageSchema>;

const todoCommentReplyPageSchema = z.object({
  items: z.array(todoCommentSchema),
  pagination: todoCommentCursorPaginationSchema,
});
export type TodoCommentReplyPage = z.infer<typeof todoCommentReplyPageSchema>;

const todoCommentChainSchema = z.object({ comments: z.array(todoCommentSchema) });
export type TodoCommentChain = z.infer<typeof todoCommentChainSchema>;

const todoCommentLikeResultSchema = todoCommentLikeResponseSchema.pick({
  commentId: true,
  isLiked: true,
  likeCount: true,
});
export type TodoCommentLikeResult = z.infer<typeof todoCommentLikeResultSchema>;
