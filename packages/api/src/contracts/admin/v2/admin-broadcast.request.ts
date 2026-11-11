import { z } from "zod";

import { dateSchema, timeOfDaySchema } from "../../../common/datetime.js";
import { entityIdSchema } from "../../../common/entity-id.js";
import { SUPPORTED_LOCALES } from "../../../vocabulary/locale.constants.js";
import { broadcastNotificationSchema } from "../v1/admin.request.js";

const localizedCopySchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").max(100, "제목은 100자 이하로 입력해주세요"),
  body: z.string().min(1, "내용을 입력해주세요").max(500, "내용은 500자 이하로 입력해주세요"),
});

export const broadcastDeliverySchema = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("NOW") }),
    z.object({
      mode: z.literal("RECIPIENT_LOCAL_TIME"),
      localTime: timeOfDaySchema.describe("수신자 현지 시각 (HH:mm)"),
      date: dateSchema.describe("수신자 현지 날짜 (YYYY-MM-DD)"),
    }),
  ])
  .describe(
    "발송 시점. NOW는 접수 직후, RECIPIENT_LOCAL_TIME은 수신자 저장 시간대의 그 날짜·시각(이미 지났으면 다음 날 같은 시각)에 보낸다",
  );

export const createBroadcastCampaignSchema = broadcastNotificationSchema
  .extend({
    requestId: z
      .uuid()
      .describe(
        "클라이언트가 만든 요청 ID(UUID). 같은 ID로 다시 보내면 새로 발송하지 않고 처음 접수한 캠페인을 돌려준다",
      ),
    localizedContent: z
      .partialRecord(z.enum(SUPPORTED_LOCALES), localizedCopySchema)
      .optional()
      .describe(
        "언어별 제목·본문. 수신자 언어에 항목이 없으면 title·body로 보낸다 (선택, 생략하면 모두 title·body)",
      ),
    delivery: broadcastDeliverySchema
      .default({ mode: "NOW" })
      .describe("발송 시점 (선택, 기본 NOW)"),
  })
  .describe("브로드캐스트 캠페인 생성 요청")
  .meta({
    example: {
      requestId: "0f8b8a52-5b0e-4f39-9f8b-6f3b3c1f2a10",
      title: "새로운 기능이 출시되었습니다!",
      body: "지금 바로 확인해보세요.",
      targetFilter: "ALL",
    },
  });

export type CreateBroadcastCampaignInput = z.infer<typeof createBroadcastCampaignSchema>;

export const broadcastCampaignIdParamSchema = z.object({
  campaignId: entityIdSchema.describe("브로드캐스트 캠페인 ID"),
});

export type BroadcastCampaignIdParam = z.infer<typeof broadcastCampaignIdParamSchema>;
