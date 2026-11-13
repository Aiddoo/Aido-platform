import { z } from "zod";

import { datetimeSchema, nullableDatetimeSchema } from "../../../common/datetime.js";
import { entityIdSchema } from "../../../common/entity-id.js";
import { USER_TAG_LENGTH } from "../../../vocabulary/follow.constants.js";
import { TODO_COMMENT_LIMITS } from "../../../vocabulary/todo-comment.constants.js";
import { friendTodoSchema } from "../../todo/v1/todo.response.js";

export const todoCommentAuthorSchema = z
  .object({
    id: entityIdSchema.describe("댓글 작성자 ID"),
    name: z.string().nullable().describe("댓글 작성자 이름 (미설정 시 null)"),
    userTag: z
      .string()
      .length(USER_TAG_LENGTH)
      .optional()
      .describe("댓글 작성자 Aido ID (8자 영숫자 대문자, 같은 이름의 작성자 구분용, 1.13.0+)"),
    profileImage: z.string().nullable().describe("댓글 작성자 프로필 이미지 URL (미설정 시 null)"),
    isTodoOwner: z.boolean().describe("할 일 작성자 여부"),
  })
  .describe("댓글 작성자");

export const todoCommentReplyTargetSchema = z
  .object({
    commentId: entityIdSchema.describe("답한 글 ID (같은 묶음의 댓글 또는 답글)"),
    authorName: z.string().nullable().describe("답글 대상 작성자 이름 (확인할 수 없으면 null)"),
  })
  .describe("답글 대상");

export const todoCommentViewerSchema = z
  .object({
    isLiked: z.boolean().describe("현재 사용자의 좋아요 여부"),
    canEdit: z.boolean().describe("현재 사용자의 수정 가능 여부"),
    canDelete: z.boolean().describe("현재 사용자의 삭제 가능 여부"),
    canReply: z.boolean().describe("현재 사용자의 답글 작성 가능 여부"),
    canReport: z
      .boolean()
      .optional()
      .describe(
        "현재 사용자가 이 댓글을 신고할 수 있는지 (남의 댓글이고 가리지 않았을 때, 1.13.0+)",
      ),
    canBlock: z
      .boolean()
      .optional()
      .describe("현재 사용자가 이 댓글 작성자를 차단할 수 있는지 (1.13.0+)"),
  })
  .describe("현재 사용자의 댓글 권한과 상태");

/** 대화와 개요에서 공유하는 v1 댓글. 1.14.1부터 댓글·답글 2단계 값만 내려간다. */
export const todoCommentSchema = z
  .object({
    id: entityIdSchema.describe("댓글 ID"),
    threadId: entityIdSchema.describe("묶음 머리 댓글 ID (댓글이면 자기 ID)"),
    parentId: entityIdSchema.nullable().describe("답글이 속한 묶음 머리 댓글 ID (댓글이면 null)"),
    depth: z.number().int().nonnegative().describe("댓글은 0, 답글은 1"),
    author: todoCommentAuthorSchema
      .nullable()
      .describe("댓글 작성자 (삭제되어 작성자를 표시하지 않으면 null)"),
    content: z.string().nullable().describe("댓글 내용 (삭제된 댓글이면 null)"),
    isDeleted: z.boolean().describe("댓글 삭제 여부"),
    isAuthorBlocked: z
      .boolean()
      .optional()
      .describe(
        "나와 작성자 사이에 차단이 있어 내용을 가렸는지 여부. 가린 댓글은 구 앱 호환을 위해 isDeleted도 true이고 author·content는 null입니다 (1.13.0+)",
      ),
    isEdited: z.boolean().describe("댓글 수정 여부"),
    likeCount: z.number().int().nonnegative().describe("활성 좋아요 수"),
    replyCount: z.number().int().nonnegative().describe("묶음에 보이는 답글 수 (답글은 0)"),
    replyTo: todoCommentReplyTargetSchema.nullable().describe("답글 대상 (최상위 댓글이면 null)"),
    viewer: todoCommentViewerSchema,
    createdAt: datetimeSchema.describe("댓글 생성 시각 (ISO 8601 UTC)"),
    editedAt: nullableDatetimeSchema.describe("댓글 최종 수정 시각 (수정하지 않았으면 null)"),
  })
  .describe("평탄한 할 일 댓글");

export const todoCommentCursorPaginationSchema = z
  .object({
    previousCursor: z.string().nullable().describe("이전 페이지 커서 (없으면 null)"),
    nextCursor: z.string().nullable().describe("다음 페이지 커서 (없으면 null)"),
    hasPrevious: z.boolean().describe("이전 페이지 존재 여부"),
    hasNext: z.boolean().describe("다음 페이지 존재 여부"),
    size: z.number().int().positive().describe("요청한 페이지 크기"),
  })
  .describe("댓글 커서 페이지네이션");

export const todoCommentReplySummarySchema = z
  .object({
    totalCount: z.number().int().nonnegative().describe("묶음에 보이는 전체 답글 수"),
    hiddenCount: z.number().int().nonnegative().describe("개요에서 아직 보여 주지 않은 댓글 수"),
    hasMore: z.boolean().describe("개요 밖에 더 볼 댓글이 있는지 여부"),
    participantAuthors: z
      .array(todoCommentAuthorSchema)
      .max(TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE)
      .describe(
        `대화 참여 작성자 미리보기 (최대 ${TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE}명)`,
      ),
  })
  .describe("댓글 답글 요약");

export const todoCommentOverviewItemSchema = z
  .object({
    comment: todoCommentSchema.describe("최상위 댓글"),
    previewReply: todoCommentSchema.nullable().describe("대표 답글 (없으면 null)"),
    replySummary: todoCommentReplySummarySchema,
  })
  .describe("댓글 개요 항목");

/** 최상위 댓글과 답글 미리보기 한 건을 보여 주는 댓글 개요 페이지. */
export const todoCommentOverviewResponseSchema = z
  .object({
    items: z.array(todoCommentOverviewItemSchema).describe("최상위 댓글 개요 목록"),
    pagination: todoCommentCursorPaginationSchema,
  })
  .describe("할 일 댓글 개요 응답");

const todoConversationLaneDepthsSchema = z.array(z.number().int().nonnegative()).refine(
  (depths) =>
    depths.every((depth, index) => {
      const previousDepth = depths[index - 1];
      return previousDepth == null || depth > previousDepth;
    }),
  "연결선 depth는 중복 없이 오름차순이어야 합니다.",
);

export const todoConversationIncomingBranchSchema = z
  .object({
    fromDepth: z.number().int().nonnegative().describe("부모 연결선의 시각 depth"),
    toDepth: z.number().int().positive().describe("현재 댓글 아바타의 시각 depth"),
  })
  .refine(({ fromDepth, toDepth }) => toDepth === fromDepth + 1, {
    error: "답글 branch는 직계 부모 depth에서 현재 depth로 이어져야 합니다.",
  })
  .describe("부모 연결선에서 현재 댓글 아바타로 휘어지는 branch");

export const todoConversationConnectionSchema = z
  .object({
    visualDepth: z
      .number()
      .int()
      .nonnegative()
      .describe("클라이언트가 그대로 x축에 배치할 댓글의 시각 depth"),
    upperLaneDepths: todoConversationLaneDepthsSchema.describe(
      "행 상단에서 아바타 중심까지 그릴 연결선 depth (중복 없는 오름차순)",
    ),
    lowerLaneDepths: todoConversationLaneDepthsSchema.describe(
      "아바타 중심에서 행 하단까지 그릴 연결선 depth (중복 없는 오름차순)",
    ),
    incomingBranch: todoConversationIncomingBranchSchema
      .nullable()
      .describe("답글이면 부모 lane에서 아바타로 이어지는 branch, root면 null"),
  })
  .check(({ value: connection, issues }) => {
    const expectedBranch =
      connection.visualDepth === 0
        ? null
        : { fromDepth: connection.visualDepth - 1, toDepth: connection.visualDepth };

    if (
      (expectedBranch == null && connection.incomingBranch != null) ||
      (expectedBranch != null &&
        (connection.incomingBranch?.fromDepth !== expectedBranch.fromDepth ||
          connection.incomingBranch.toDepth !== expectedBranch.toDepth))
    ) {
      issues.push({
        code: "custom",
        input: connection,
        path: ["incomingBranch"],
        message: "incoming branch는 visualDepth의 직계 부모 lane과 일치해야 합니다.",
      });
    }

    if (connection.upperLaneDepths.some((depth) => depth >= connection.visualDepth)) {
      issues.push({
        code: "custom",
        input: connection,
        path: ["upperLaneDepths"],
        message: "상단 lane은 현재 visualDepth보다 앞선 조상 depth만 담아야 합니다.",
      });
    }

    if (connection.lowerLaneDepths.some((depth) => depth > connection.visualDepth)) {
      issues.push({
        code: "custom",
        input: connection,
        path: ["lowerLaneDepths"],
        message: "하단 lane은 현재 visualDepth보다 깊을 수 없습니다.",
      });
    }
  })
  .describe("클라이언트 tree 추론 없이 그리는 댓글 행 연결선 topology");

export const todoConversationItemSchema = z
  .object({
    comment: todoCommentSchema,
    connection: todoConversationConnectionSchema,
    isFocused: z.boolean().describe("요청한 focus 댓글인지 여부"),
  })
  .describe("평탄한 댓글 대화 행");

export const todoConversationFocusSchema = z
  .object({
    commentId: entityIdSchema.describe("focus 댓글 ID"),
    itemIndex: z.number().int().nonnegative().describe("현재 items에서 focus 댓글의 위치"),
    precedingAncestors: z
      .array(todoConversationItemSchema)
      .max(TODO_COMMENT_LIMITS.FOCUS_ANCESTOR_MAX_SIZE)
      .describe(
        `focus 답글 앞 페이지 밖의 묶음 머리 댓글 (최대 ${TODO_COMMENT_LIMITS.FOCUS_ANCESTOR_MAX_SIZE}개)`,
      ),
    omittedAncestorCount: z
      .number()
      .int()
      .nonnegative()
      .describe("생략한 앞 문맥 수 (2단계라 항상 0)"),
  })
  .describe("focus 댓글의 대화 문맥");

/** 묶음 순서를 유지하고 묶음 안은 머리 댓글 다음 답글을 작성 순으로 둔 대화 페이지. */
export const todoConversationResponseSchema = z
  .object({
    items: z
      .array(todoConversationItemSchema)
      .describe("묶음 머리가 답글보다 먼저 오는 댓글 대화 행"),
    focus: todoConversationFocusSchema.nullable().describe("focus 댓글 문맥 (일반 목록이면 null)"),
    pagination: todoCommentCursorPaginationSchema,
  })
  .describe("할 일 댓글 대화 응답");

export const todoDetailsResponseSchema = z
  .object({
    todo: friendTodoSchema.describe("댓글 화면에 표시할 할 일"),
    owner: todoCommentAuthorSchema.omit({ isTodoOwner: true }).describe("할 일 작성자"),
    permissions: z
      .object({
        canEdit: z.boolean().describe("현재 사용자의 할 일 수정 가능 여부"),
        canComment: z.boolean().describe("현재 사용자의 댓글 작성 가능 여부"),
        canNudge: z.boolean().describe("현재 사용자의 콕 찌르기 가능 여부"),
      })
      .describe("현재 사용자의 할 일 권한"),
    metrics: z
      .object({
        viewCount: z.number().int().nonnegative().describe("할 일의 중복 제거 조회 수"),
        commentCount: z.number().int().nonnegative().describe("삭제되지 않은 댓글 수"),
      })
      .describe("할 일 댓글 화면 지표"),
  })
  .describe("댓글 화면용 할 일 상세 응답");

/** 이어 쓴 글 전체를 쓴 순서로 돌려준다. 한 개만 썼으면 길이 1이다. */
export const todoCommentChainResponseSchema = z
  .object({
    comments: z
      .array(todoCommentSchema)
      .min(1)
      .max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE)
      .describe("위에서 아래 순서로 생성되거나 재생된 댓글 사슬"),
  })
  .describe("할 일 댓글 이어 쓰기 응답");

/** 수정 응답. 최상위와 답글이 같은 모양이라 분기가 없다. */
export const todoCommentMutationResponseSchema = z
  .object({
    comment: todoCommentSchema.describe("수정된 댓글"),
  })
  .describe("할 일 댓글 수정 응답");

export const todoCommentLikeResponseSchema = z
  .object({
    commentId: entityIdSchema.describe("좋아요 상태가 바뀐 댓글 ID"),
    isLiked: z.boolean().describe("현재 사용자의 좋아요 여부"),
    likeCount: z.number().int().nonnegative().describe("댓글의 활성 좋아요 수"),
  })
  .describe("할 일 댓글 좋아요 응답");

export const deleteTodoCommentResponseSchema = z
  .object({
    commentId: entityIdSchema.describe("삭제된 댓글 ID"),
    isDeleted: z.literal(true).describe("댓글 삭제 여부 (항상 true)"),
  })
  .describe("할 일 댓글 삭제 응답");

export type TodoComment = z.infer<typeof todoCommentSchema>;
export type TodoCommentAuthor = z.infer<typeof todoCommentAuthorSchema>;
export type TodoCommentReplyTarget = z.infer<typeof todoCommentReplyTargetSchema>;
export type TodoCommentCursorPagination = z.infer<typeof todoCommentCursorPaginationSchema>;
export type TodoCommentReplySummary = z.infer<typeof todoCommentReplySummarySchema>;
export type TodoCommentOverviewItem = z.infer<typeof todoCommentOverviewItemSchema>;
export type TodoCommentOverviewResponse = z.infer<typeof todoCommentOverviewResponseSchema>;
export type TodoConversationIncomingBranch = z.infer<typeof todoConversationIncomingBranchSchema>;
export type TodoConversationConnection = z.infer<typeof todoConversationConnectionSchema>;
export type TodoConversationItem = z.infer<typeof todoConversationItemSchema>;
export type TodoConversationResponse = z.infer<typeof todoConversationResponseSchema>;
export type TodoConversationFocus = z.infer<typeof todoConversationFocusSchema>;
export type TodoDetailsResponse = z.infer<typeof todoDetailsResponseSchema>;
export type TodoCommentChainResponse = z.infer<typeof todoCommentChainResponseSchema>;
export type TodoCommentMutationResponse = z.infer<typeof todoCommentMutationResponseSchema>;
export type TodoCommentLikeResponse = z.infer<typeof todoCommentLikeResponseSchema>;
export type DeleteTodoCommentResponse = z.infer<typeof deleteTodoCommentResponseSchema>;
