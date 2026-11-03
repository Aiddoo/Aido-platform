import { z } from "zod";

import { broadcastNotificationSchema } from "../v1/admin.request.js";

export const createBroadcastCampaignSchema = broadcastNotificationSchema
  .extend({
    requestId: z
      .uuid()
      .describe(
        "클라이언트가 만든 요청 ID(UUID). 같은 ID로 다시 보내면 새로 발송하지 않고 처음 접수한 캠페인을 돌려준다",
      ),
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
  campaignId: z.cuid().describe("브로드캐스트 캠페인 ID"),
});

export type BroadcastCampaignIdParam = z.infer<typeof broadcastCampaignIdParamSchema>;
