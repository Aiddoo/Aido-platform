import { z } from "zod";

import { datetimeSchema, nullableDatetimeSchema } from "../../../common/datetime.js";
import { entityIdSchema } from "../../../common/entity-id.js";
import { USER_TAG_LENGTH } from "../../../vocabulary/follow.constants.js";
import { TODO_COMMENT_LIMITS } from "../../../vocabulary/todo-comment.constants.js";
import * as v1 from "../v1/todo-comment.response.js";

export const todoCommentAuthorSchema = v1.todoCommentAuthorSchema
  .extend({
    userTag: z
      .string()
      .length(USER_TAG_LENGTH)
      .nullable()
      .meta({ description: "댓글 작성자 Aido ID (8자 영숫자 대문자, 같은 이름의 작성자 구분용)" }),
  })
  .meta({ description: "댓글 작성자" });

export const todoCommentViewerSchema = v1.todoCommentViewerSchema
  .extend({
    canReport: z.boolean().meta({ description: "현재 사용자가 이 댓글을 신고할 수 있는지" }),
    canBlock: z.boolean().meta({ description: "현재 사용자가 이 댓글 작성자를 차단할 수 있는지" }),
  })
  .meta({ description: "현재 사용자의 댓글 권한과 상태" });

export const todoCommentReplyTargetSchema = z
  .object({
    commentId: entityIdSchema.meta({ description: "답한 글 ID (같은 묶음의 댓글 또는 답글)" }),
    authorName: z
      .string()
      .nullable()
      .meta({ description: "@멘션으로 보여 줄 답한 글 작성자 이름 (차단·미설정이면 null)" }),
  })
  .meta({ description: "답글 대상" });

/** 댓글과 답글이 같은 모양이다. 답글이면 threadCommentId가 묶음 머리 댓글이다. */
export const todoCommentSchema = z
  .object({
    id: entityIdSchema.meta({ description: "댓글 ID" }),
    todoId: z.int().positive().meta({ description: "할 일 ID" }),
    threadCommentId: entityIdSchema
      .nullable()
      .meta({ description: "답글이 속한 묶음의 머리 댓글 ID (댓글이면 null)" }),
    replyTo: todoCommentReplyTargetSchema
      .nullable()
      .meta({ description: "답글 대상 (댓글이면 null)" }),
    author: todoCommentAuthorSchema
      .nullable()
      .meta({ description: "댓글 작성자 (삭제되었거나 차단 관계로 가렸으면 null)" }),
    content: z.string().nullable().meta({ description: "댓글 내용 (삭제되었거나 가렸으면 null)" }),
    likeCount: z.int().nonnegative().meta({ description: "활성 좋아요 수" }),
    replyCount: z
      .int()
      .nonnegative()
      .meta({ description: "묶음에 보이는 답글 수 (답글은 항상 0)" }),
    isDeleted: z.boolean().meta({ description: "삭제되었거나 차단 관계로 가린 댓글인지" }),
    isAuthorBlocked: z.boolean().meta({ description: "나와 작성자 사이에 차단이 있어 가렸는지" }),
    isEdited: z.boolean().meta({ description: "댓글 수정 여부" }),
    viewer: todoCommentViewerSchema,
    createdAt: datetimeSchema.meta({ description: "댓글 생성 시각 (ISO 8601 UTC)" }),
    editedAt: nullableDatetimeSchema.meta({
      description: "댓글 최종 수정 시각 (수정하지 않았으면 null)",
    }),
  })
  .meta({ description: "할 일 댓글 (v2)" });

export const todoCommentThreadReplySummarySchema = z
  .object({
    totalCount: z.int().nonnegative().meta({ description: "묶음에 보이는 전체 답글 수" }),
    hiddenCount: z
      .int()
      .nonnegative()
      .meta({ description: "대표 답글 말고 아직 보여 주지 않은 답글 수" }),
    participantAuthors: z
      .array(todoCommentAuthorSchema)
      .max(TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE)
      .meta({
        description: `답글 작성자 미리보기 (할 일 주인 먼저, 최대 ${TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE}명)`,
      }),
  })
  .meta({ description: "묶음 답글 요약" });

export const todoCommentThreadSchema = z
  .object({
    comment: todoCommentSchema.meta({
      description: "묶음 머리 댓글 (답글이 남아 있으면 삭제돼도 묘비로 남는다)",
    }),
    previewReply: todoCommentSchema
      .nullable()
      .meta({ description: "대표 답글 (할 일 주인의 답글 먼저, 없으면 가장 먼저 쓴 답글)" }),
    replySummary: todoCommentThreadReplySummarySchema,
  })
  .meta({ description: "댓글 묶음" });

export const todoCommentThreadAnchorSchema = z
  .object({
    threadCommentId: entityIdSchema.meta({
      description: "anchorCommentId가 속한 묶음 머리 댓글 ID",
    }),
    replyId: entityIdSchema.nullable().meta({
      description:
        "anchorCommentId가 답글이면 그 ID (replies의 aroundReplyId로 쓴다), 댓글이면 null",
    }),
  })
  .meta({ description: "요청한 anchor 위치" });

export const todoCommentThreadsResponseSchema = z
  .object({
    items: z.array(todoCommentThreadSchema).meta({ description: "정렬 순서의 댓글 묶음" }),
    pagination: v1.todoCommentCursorPaginationSchema,
    anchor: todoCommentThreadAnchorSchema.nullable().meta({
      description: "anchorCommentId로 찾은 위치 (요청하지 않았거나 찾지 못했거나 지운 글이면 null)",
    }),
  })
  .meta({ description: "할 일 댓글 묶음 목록 응답" });

export const todoCommentRepliesResponseSchema = z
  .object({
    items: z.array(todoCommentSchema).meta({ description: "작성 순서의 답글" }),
    pagination: v1.todoCommentCursorPaginationSchema,
  })
  .meta({ description: "댓글 묶음의 답글 목록 응답" });

export type TodoComment = z.infer<typeof todoCommentSchema>;
export type TodoCommentAuthor = z.infer<typeof todoCommentAuthorSchema>;
export type TodoCommentViewer = z.infer<typeof todoCommentViewerSchema>;
export type TodoCommentReplyTarget = z.infer<typeof todoCommentReplyTargetSchema>;
export type TodoCommentThreadReplySummary = z.infer<typeof todoCommentThreadReplySummarySchema>;
export type TodoCommentThread = z.infer<typeof todoCommentThreadSchema>;
export type TodoCommentThreadAnchor = z.infer<typeof todoCommentThreadAnchorSchema>;
export type TodoCommentThreadsResponse = z.infer<typeof todoCommentThreadsResponseSchema>;
export type TodoCommentRepliesResponse = z.infer<typeof todoCommentRepliesResponseSchema>;
