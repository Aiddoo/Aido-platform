import { z } from "zod";

import {
  USER_REPORT_LIMITS,
  USER_REPORT_REASONS,
  USER_REPORT_TARGET_TYPES,
} from "../../vocabulary/user-report.constants.js";

export const userReportReasonSchema = z
  .enum(USER_REPORT_REASONS)
  .describe(
    "신고 사유 (SPAM: 스팸·광고 | HARASSMENT: 괴롭힘·혐오 | INAPPROPRIATE: 부적절한 내용 | IMPERSONATION: 사칭 | OTHER: 기타)",
  );

export const userReportTargetTypeSchema = z
  .enum(USER_REPORT_TARGET_TYPES)
  .describe(
    "신고 대상 종류 (PROFILE: 프로필·닉네임 | TODO: 할 일 | COMMENT: 댓글 | NUDGE_MESSAGE: 콕 찌르기 메시지 | CHEER_MESSAGE: 응원 메시지)",
  );

/** 신고 시트가 사용자에게 받는 값. 대상은 시트를 연 화면이 정한다. */
export const userReportFormSchema = z.object({
  reason: userReportReasonSchema,
  detail: z
    .string()
    .trim()
    .max(
      USER_REPORT_LIMITS.MAX_DETAIL_LENGTH,
      `상세 내용은 최대 ${USER_REPORT_LIMITS.MAX_DETAIL_LENGTH}자까지 입력할 수 있습니다`,
    )
    .optional()
    .describe(`신고 상세 내용 (선택, 최대 ${USER_REPORT_LIMITS.MAX_DETAIL_LENGTH}자)`),
});

export type UserReportFormInput = z.infer<typeof userReportFormSchema>;

export const createUserReportSchema = z
  .object({
    targetUserId: z
      .cuid("유효하지 않은 사용자 ID입니다")
      .describe("신고할 콘텐츠를 만든 사용자 ID (CUID 25자)"),
    targetType: userReportTargetTypeSchema,
    targetId: z
      .string()
      .trim()
      .min(1)
      .max(USER_REPORT_LIMITS.MAX_TARGET_ID_LENGTH)
      .optional()
      .describe(
        "신고할 콘텐츠 ID (할 일·콕·응원은 숫자 ID 문자열, 댓글은 CUID). PROFILE이면 보내지 않습니다",
      ),
    ...userReportFormSchema.shape,
  })
  .check(({ value, issues }) => {
    const requiresTargetId = value.targetType !== "PROFILE";
    if (requiresTargetId === (value.targetId == null)) {
      issues.push({
        code: "custom",
        input: value.targetId,
        path: ["targetId"],
        message: requiresTargetId
          ? "콘텐츠를 신고하려면 targetId가 필요합니다"
          : "프로필 신고에는 targetId를 보내지 않습니다",
      });
    }
  })
  .meta({
    example: {
      targetUserId: "clz7x5p8k0005qz0z8z8z8z8z",
      targetType: "COMMENT",
      targetId: "clz7x5p8k0099qz0z8z8z8z8z",
      reason: "HARASSMENT",
      detail: "댓글에서 계속 욕설을 해요.",
    },
  });

export type CreateUserReportInput = z.infer<typeof createUserReportSchema>;
