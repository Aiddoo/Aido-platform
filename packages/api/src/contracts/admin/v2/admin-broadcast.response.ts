import { z } from "zod";

import { datetimeSchema, nullableDatetimeSchema } from "../../../common/datetime.js";
import { entityIdSchema } from "../../../common/entity-id.js";
import {
  BROADCAST_CAMPAIGN_STATUS,
  BROADCAST_TARGET_FILTER,
} from "../../../vocabulary/admin.constants.js";
import { PUSH_DISPATCH_SKIP_REASON } from "../../../vocabulary/notification.constants.js";

const countSchema = z.number().int().nonnegative();

export const broadcastCampaignAcceptedSchema = z
  .object({
    campaignId: entityIdSchema.describe("브로드캐스트 캠페인 ID"),
    requestId: z.uuid().describe("요청에 실린 요청 ID"),
    status: z.enum(BROADCAST_CAMPAIGN_STATUS).describe("접수 시점의 캠페인 상태"),
    acceptedAt: datetimeSchema.describe("처음 접수한 시각 (ISO 8601 UTC)"),
  })
  .describe("브로드캐스트 캠페인 접수 결과. 발송은 비동기로 진행되며 결과는 캠페인 조회로 확인한다")
  .meta({
    example: {
      campaignId: "c0123456789abcdef01234567",
      requestId: "0f8b8a52-5b0e-4f39-9f8b-6f3b3c1f2a10",
      status: "QUEUED",
      acceptedAt: "2026-11-03T10:00:00.000Z",
    },
  });

export type BroadcastCampaignAccepted = z.infer<typeof broadcastCampaignAcceptedSchema>;

export const broadcastCampaignSchema = z
  .object({
    campaignId: entityIdSchema.describe("브로드캐스트 캠페인 ID"),
    requestId: z.uuid().describe("요청 ID"),
    status: z.enum(BROADCAST_CAMPAIGN_STATUS).describe("캠페인 상태"),
    title: z.string().describe("알림 제목"),
    targetFilter: z.enum(BROADCAST_TARGET_FILTER).describe("대상 필터"),
    force: z.boolean().describe("수신 설정을 무시한 강제 발송 여부"),
    recipients: z
      .object({
        processed: countSchema.describe("분배를 마친 대상 사용자 수"),
        queued: countSchema.describe("알림을 만들어 발송 대기열에 올린 수 (전달 성공 수가 아님)"),
      })
      .describe("대상 분배 진행"),
    dispatches: z
      .object({
        pending: countSchema.describe("발송 대기"),
        processing: countSchema.describe("발송 중"),
        sent: countSchema.describe("공급자에 한 번 이상 수락됨"),
        skipped: countSchema.describe("수신 설정·빈도 제한·토큰 없음으로 건너뜀"),
        skippedByReason: z
          .partialRecord(z.enum(PUSH_DISPATCH_SKIP_REASON), countSchema)
          .optional()
          .describe(
            "건너뛴 사용자 수를 이유별로. 없는 이유는 키가 없다. 1.14.1 이하 서버 응답에는 없다",
          ),
        failed: countSchema.describe("모든 기기에서 공급자가 거절함"),
      })
      .describe("사용자별 발송 상태 집계"),
    deliveries: z
      .object({
        accepted: countSchema.describe("공급자가 수락했고 기기 결과를 기다림"),
        delivered: countSchema.describe("기기 전달 확인"),
        failed: countSchema.describe("공급자 또는 기기 전달 실패"),
        unknown: countSchema.describe("보관 기간 안에 결과를 받지 못함"),
      })
      .describe("기기별 전달 결과 집계"),
    failureReason: z.string().nullable().describe("분배가 멈춘 이유 (FAILED일 때)"),
    createdAt: datetimeSchema.describe("접수 시각 (ISO 8601 UTC)"),
    startedAt: nullableDatetimeSchema.describe("분배 시작 시각"),
    completedAt: nullableDatetimeSchema.describe("분배 완료 시각"),
  })
  .describe("브로드캐스트 캠페인 진행과 전달 결과");

export type BroadcastCampaign = z.infer<typeof broadcastCampaignSchema>;
