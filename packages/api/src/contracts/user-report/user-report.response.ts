import { z } from "zod";

import { datetimeSchema } from "../../common/datetime.js";
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
