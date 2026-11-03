import { z } from "zod";

import { TODO_COMMENT_LIMITS } from "../../../vocabulary/todo-comment.constants.js";
import {
  todoCommentCursorSchema,
  todoCommentIdSchema,
  todoCommentPageSizeSchema,
  todoCommentSortSchema,
} from "../v1/todo-comment.request.js";

/** 알림·링크로 연 댓글이 든 페이지를 받을 때는 cursor 없이 anchorCommentId만 보낸다. */
export const getTodoCommentThreadsQuerySchema = z
  .object({
    sort: todoCommentSortSchema,
    cursor: todoCommentCursorSchema.optional(),
    size: todoCommentPageSizeSchema(TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE),
    anchorCommentId: todoCommentIdSchema
      .optional()
      .describe("이 댓글(또는 답글)이 속한 묶음이 든 페이지를 받는다"),
  })
  .check(({ value, issues }) => {
    if (value.cursor != null && value.anchorCommentId != null) {
      issues.push({
        code: "custom",
        input: value,
        message: "댓글 위치는 cursor, anchorCommentId 중 하나만 지정할 수 있습니다.",
        path: ["anchorCommentId"],
      });
    }
  })
  .describe("할 일 댓글 묶음 목록 조회 쿼리");

export const getTodoCommentRepliesQuerySchema = z
  .object({
    cursor: todoCommentCursorSchema.optional(),
    size: todoCommentPageSizeSchema(TODO_COMMENT_LIMITS.REPLY_PAGE_DEFAULT_SIZE),
    aroundReplyId: todoCommentIdSchema
      .optional()
      .describe("이 답글이 든 페이지를 받는다 (알림으로 연 답글 강조)"),
  })
  .check(({ value, issues }) => {
    if (value.cursor != null && value.aroundReplyId != null) {
      issues.push({
        code: "custom",
        input: value,
        message: "답글 위치는 cursor, aroundReplyId 중 하나만 지정할 수 있습니다.",
        path: ["aroundReplyId"],
      });
    }
  })
  .describe("댓글 묶음의 답글 목록 조회 쿼리");

export type GetTodoCommentThreadsQuery = z.infer<typeof getTodoCommentThreadsQuerySchema>;
export type GetTodoCommentRepliesQuery = z.infer<typeof getTodoCommentRepliesQuerySchema>;
