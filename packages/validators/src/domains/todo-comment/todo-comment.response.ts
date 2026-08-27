import { z } from 'zod';

import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';
import { todoSchema } from '../todo/todo.response';
import { TODO_COMMENT_LIMITS } from './todo-comment.constants';

export const todoCommentAuthorSchema = z
  .object({
    id: z.cuid().describe('댓글 작성자 ID (CUID)'),
    name: z.string().nullable().describe('댓글 작성자 이름 (미설정 시 null)'),
    profileImage: z.string().nullable().describe('댓글 작성자 프로필 이미지 URL (미설정 시 null)'),
    isTodoOwner: z.boolean().describe('할 일 작성자 여부'),
  })
  .describe('댓글 작성자');

export const todoCommentReplyTargetSchema = z
  .object({
    commentId: z.cuid().describe('직계 부모 댓글 ID (CUID)'),
    authorName: z.string().nullable().describe('답글 대상 작성자 이름 (확인할 수 없으면 null)'),
  })
  .describe('답글 대상');

export const todoCommentViewerSchema = z
  .object({
    isLiked: z.boolean().describe('현재 사용자의 좋아요 여부'),
    canEdit: z.boolean().describe('현재 사용자의 수정 가능 여부'),
    canDelete: z.boolean().describe('현재 사용자의 삭제 가능 여부'),
    canReply: z.boolean().describe('현재 사용자의 답글 작성 가능 여부'),
  })
  .describe('현재 사용자의 댓글 권한과 상태');

/** 대화와 개요에서 공유하는 평탄한 댓글 본문·위치 정보. */
export const todoCommentSchema = z
  .object({
    id: z.cuid().describe('댓글 ID (CUID)'),
    /** 최상위 댓글은 자기 id, 답글은 최상위 댓글 id */
    threadId: z.cuid().describe('댓글 대화의 최상위 댓글 ID (CUID)'),
    /** 직계 부모. null이면 최상위 댓글 */
    parentId: z.cuid().nullable().describe('직계 부모 댓글 ID (최상위 댓글이면 null)'),
    /** 뿌리에서 이 댓글까지의 깊이 (최상위는 0) */
    depth: z.number().int().nonnegative().describe('대화에서 댓글의 깊이 (최상위 댓글은 0)'),
    author: todoCommentAuthorSchema
      .nullable()
      .describe('댓글 작성자 (삭제되어 작성자를 표시하지 않으면 null)'),
    content: z.string().nullable().describe('댓글 내용 (삭제된 댓글이면 null)'),
    isDeleted: z.boolean().describe('댓글 삭제 여부'),
    isEdited: z.boolean().describe('댓글 수정 여부'),
    likeCount: z.number().int().nonnegative().describe('활성 좋아요 수'),
    /** 직계 답글 수 (자손 총합이 아니다) */
    replyCount: z.number().int().nonnegative().describe('화면에 표시되는 직계 답글 수'),
    /** 누구에게 단 답글인지 — @멘션의 근거 */
    replyTo: todoCommentReplyTargetSchema.nullable().describe('답글 대상 (최상위 댓글이면 null)'),
    viewer: todoCommentViewerSchema,
    createdAt: datetimeSchema.describe('댓글 생성 시각 (ISO 8601 UTC)'),
    editedAt: nullableDatetimeSchema.describe('댓글 최종 수정 시각 (수정하지 않았으면 null)'),
  })
  .describe('평탄한 할 일 댓글');

export const todoCommentCursorPaginationSchema = z
  .object({
    previousCursor: z.string().nullable().describe('이전 페이지 커서 (없으면 null)'),
    nextCursor: z.string().nullable().describe('다음 페이지 커서 (없으면 null)'),
    hasPrevious: z.boolean().describe('이전 페이지 존재 여부'),
    hasNext: z.boolean().describe('다음 페이지 존재 여부'),
    size: z.number().int().positive().describe('요청한 페이지 크기'),
  })
  .describe('댓글 커서 페이지네이션');

export const todoCommentReplySummarySchema = z
  .object({
    totalCount: z.number().int().nonnegative().describe('표시 가능한 전체 답글과 후손 수'),
    hiddenCount: z.number().int().nonnegative().describe('개요에서 아직 보여 주지 않은 댓글 수'),
    hasMore: z.boolean().describe('개요 밖에 더 볼 댓글이 있는지 여부'),
    participantAuthors: z
      .array(todoCommentAuthorSchema)
      .max(TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE)
      .describe(
        `대화 참여 작성자 미리보기 (최대 ${TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE}명)`,
      ),
  })
  .describe('댓글 답글 요약');

export const todoCommentOverviewItemSchema = z
  .object({
    comment: todoCommentSchema.describe('최상위 댓글'),
    previewReply: todoCommentSchema.nullable().describe('대표 직계 답글 (없으면 null)'),
    replySummary: todoCommentReplySummarySchema,
  })
  .describe('댓글 개요 항목');

/** 최상위 댓글과 답글 미리보기 한 건을 보여 주는 댓글 개요 페이지. */
export const todoCommentOverviewResponseSchema = z
  .object({
    items: z.array(todoCommentOverviewItemSchema).describe('최상위 댓글 개요 목록'),
    pagination: todoCommentCursorPaginationSchema,
  })
  .describe('할 일 댓글 개요 응답');

const todoConversationLaneDepthsSchema = z.array(z.number().int().nonnegative()).refine(
  (depths) =>
    depths.every((depth, index) => {
      const previousDepth = depths[index - 1];
      return previousDepth === undefined || depth > previousDepth;
    }),
  '연결선 depth는 중복 없이 오름차순이어야 합니다.',
);

export const todoConversationIncomingBranchSchema = z
  .object({
    fromDepth: z.number().int().nonnegative().describe('부모 연결선의 시각 depth'),
    toDepth: z.number().int().positive().describe('현재 댓글 아바타의 시각 depth'),
  })
  .refine(({ fromDepth, toDepth }) => toDepth === fromDepth + 1, {
    message: '답글 branch는 직계 부모 depth에서 현재 depth로 이어져야 합니다.',
  })
  .describe('부모 연결선에서 현재 댓글 아바타로 휘어지는 branch');

export const todoConversationConnectionSchema = z
  .object({
    visualDepth: z
      .number()
      .int()
      .nonnegative()
      .describe('클라이언트가 그대로 x축에 배치할 댓글의 시각 depth'),
    upperLaneDepths: todoConversationLaneDepthsSchema.describe(
      '행 상단에서 아바타 중심까지 그릴 연결선 depth (중복 없는 오름차순)',
    ),
    lowerLaneDepths: todoConversationLaneDepthsSchema.describe(
      '아바타 중심에서 행 하단까지 그릴 연결선 depth (중복 없는 오름차순)',
    ),
    incomingBranch: todoConversationIncomingBranchSchema
      .nullable()
      .describe('답글이면 부모 lane에서 아바타로 이어지는 branch, root면 null'),
  })
  .superRefine((connection, context) => {
    const expectedBranch =
      connection.visualDepth === 0
        ? null
        : { fromDepth: connection.visualDepth - 1, toDepth: connection.visualDepth };

    if (
      (expectedBranch === null && connection.incomingBranch !== null) ||
      (expectedBranch !== null &&
        (connection.incomingBranch?.fromDepth !== expectedBranch.fromDepth ||
          connection.incomingBranch.toDepth !== expectedBranch.toDepth))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['incomingBranch'],
        message: 'incoming branch는 visualDepth의 직계 부모 lane과 일치해야 합니다.',
      });
    }

    if (connection.upperLaneDepths.some((depth) => depth >= connection.visualDepth)) {
      context.addIssue({
        code: 'custom',
        path: ['upperLaneDepths'],
        message: '상단 lane은 현재 visualDepth보다 앞선 조상 depth만 담아야 합니다.',
      });
    }

    if (connection.lowerLaneDepths.some((depth) => depth > connection.visualDepth)) {
      context.addIssue({
        code: 'custom',
        path: ['lowerLaneDepths'],
        message: '하단 lane은 현재 visualDepth보다 깊을 수 없습니다.',
      });
    }
  })
  .describe('클라이언트 tree 추론 없이 그리는 댓글 행 연결선 topology');

export const todoConversationItemSchema = z
  .object({
    comment: todoCommentSchema,
    connection: todoConversationConnectionSchema,
    isFocused: z.boolean().describe('요청한 focus 댓글인지 여부'),
  })
  .describe('평탄한 댓글 대화 행');

export const todoConversationFocusSchema = z
  .object({
    commentId: z.cuid().describe('focus 댓글 ID (CUID)'),
    itemIndex: z.number().int().nonnegative().describe('현재 items에서 focus 댓글의 위치'),
    precedingAncestors: z
      .array(todoConversationItemSchema)
      .max(TODO_COMMENT_LIMITS.FOCUS_ANCESTOR_MAX_SIZE)
      .describe(
        `현재 페이지 앞에서 이어지는 focus 조상 목록 (최대 ${TODO_COMMENT_LIMITS.FOCUS_ANCESTOR_MAX_SIZE}개)`,
      ),
    omittedAncestorCount: z
      .number()
      .int()
      .nonnegative()
      .describe('응답 크기 제한으로 생략한 더 오래된 조상 수'),
  })
  .describe('focus 댓글의 대화 문맥');

/** 한 todo의 root block들을 유지한 parent-before-child DFS 대화 페이지. */
export const todoConversationResponseSchema = z
  .object({
    items: z.array(todoConversationItemSchema).describe('부모가 자식보다 먼저 오는 댓글 대화 행'),
    focus: todoConversationFocusSchema.nullable().describe('focus 댓글 문맥 (일반 목록이면 null)'),
    pagination: todoCommentCursorPaginationSchema,
  })
  .describe('할 일 댓글 대화 응답');

export const todoDetailsResponseSchema = z
  .object({
    todo: todoSchema.describe('댓글 화면에 표시할 할 일'),
    owner: todoCommentAuthorSchema.omit({ isTodoOwner: true }).describe('할 일 작성자'),
    permissions: z
      .object({
        canEdit: z.boolean().describe('현재 사용자의 할 일 수정 가능 여부'),
        canComment: z.boolean().describe('현재 사용자의 댓글 작성 가능 여부'),
        canNudge: z.boolean().describe('현재 사용자의 콕 찌르기 가능 여부'),
      })
      .describe('현재 사용자의 할 일 권한'),
    metrics: z
      .object({
        viewCount: z.number().int().nonnegative().describe('할 일의 중복 제거 조회 수'),
        commentCount: z.number().int().nonnegative().describe('삭제되지 않은 댓글 수'),
      })
      .describe('할 일 댓글 화면 지표'),
  })
  .describe('댓글 화면용 할 일 상세 응답');

/**
 * 작성 응답 — 한 번에 이어 쓴 사슬 전체를 위에서 아래 순서로 돌려준다.
 * 한 개만 썼으면 길이 1이다.
 */
export const todoCommentChainResponseSchema = z
  .object({
    comments: z
      .array(todoCommentSchema)
      .min(1)
      .max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE)
      .describe('위에서 아래 순서로 생성되거나 재생된 댓글 사슬'),
  })
  .describe('할 일 댓글 이어 쓰기 응답');

/** 수정 응답. 최상위와 답글이 같은 모양이라 분기가 없다. */
export const todoCommentMutationResponseSchema = z
  .object({
    comment: todoCommentSchema.describe('수정된 댓글'),
  })
  .describe('할 일 댓글 수정 응답');

export const todoCommentLikeResponseSchema = z
  .object({
    commentId: z.cuid().describe('좋아요 상태가 바뀐 댓글 ID (CUID)'),
    isLiked: z.boolean().describe('현재 사용자의 좋아요 여부'),
    likeCount: z.number().int().nonnegative().describe('댓글의 활성 좋아요 수'),
  })
  .describe('할 일 댓글 좋아요 응답');

export const deleteTodoCommentResponseSchema = z
  .object({
    commentId: z.cuid().describe('삭제된 댓글 ID (CUID)'),
    isDeleted: z.literal(true).describe('댓글 삭제 여부 (항상 true)'),
  })
  .describe('할 일 댓글 삭제 응답');

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
