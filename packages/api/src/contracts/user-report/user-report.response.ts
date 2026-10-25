import { z } from "zod";

import { datetimeSchema, nullableDatetimeSchema } from "../../common/datetime.js";
import { USER_REPORT_STATUSES } from "../../vocabulary/user-report.constants.js";

export const userReportStatusSchema = z
  .enum(USER_REPORT_STATUSES)
  .describe("신고 처리 상태 (OPEN: 접수 | RESOLVED: 처리 완료)");

export const userReportSchema = z
  .object({
    id: z.cuid().describe("신고 ID (CUID 25자)"),
    status: userReportStatusSchema,
    createdAt: datetimeSchema.describe("신고 접수 시각 (ISO 8601 UTC)"),
  })
  .describe("접수된 신고");

export type UserReport = z.infer<typeof userReportSchema>;

export const createUserReportResponseSchema = z
  .object({
    message: z.string().describe("결과 메시지"),
    report: userReportSchema,
  })
  .meta({
    example: {
      message: "신고를 접수했습니다.",
      report: {
        id: "clz7x5p8k0123qz0z8z8z8z8z",
        status: "OPEN",
        createdAt: "2026-10-26T09:00:00.000Z",
      },
    },
  });

export type CreateUserReportResponse = z.infer<typeof createUserReportResponseSchema>;

export const resolvedUserReportSchema = userReportSchema
  .extend({
    resolvedAt: nullableDatetimeSchema.describe("처리 완료 시각 (ISO 8601 UTC, 접수 상태면 null)"),
    resolutionNote: z.string().nullable().describe("운영자가 남긴 조치 내용 (접수 상태면 null)"),
  })
  .describe("운영자가 처리한 신고");

export const resolveUserReportResponseSchema = z
  .object({
    message: z.string().describe("결과 메시지"),
    report: resolvedUserReportSchema,
  })
  .meta({
    example: {
      message: "신고를 처리 완료로 바꿨습니다.",
      report: {
        id: "clz7x5p8k0123qz0z8z8z8z8z",
        status: "RESOLVED",
        createdAt: "2026-10-26T09:00:00.000Z",
        resolvedAt: "2026-10-26T12:00:00.000Z",
        resolutionNote: "약관 위반 댓글을 삭제하고 작성자에게 경고했습니다.",
      },
    },
  });

export type ResolveUserReportResponse = z.infer<typeof resolveUserReportResponseSchema>;
