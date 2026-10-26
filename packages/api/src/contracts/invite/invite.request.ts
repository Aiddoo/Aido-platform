import { z } from "zod";

import { getFollowsQuerySchema } from "../follow/follow.request.js";
import { inviteCodeSchema, redemptionStatusSchema } from "./invite.common.js";

export const inviteCodeParamSchema = z.object({
  code: inviteCodeSchema,
});

export type InviteCodeParam = z.infer<typeof inviteCodeParamSchema>;

export const redeemInviteRequestSchema = z
  .object({
    installationId: z
      .string()
      .min(1)
      .max(128, "설치 ID는 128자 이내여야 해요")
      .optional()
      .describe(
        "앱 설치 식별자 (iOS IDFV 또는 Android ID, 최대 128자, 같은 기기 중복 보상 방지용)",
      ),
  })
  .meta({ example: { installationId: "6F9619FF-8B86-D011-B42D-00C04FC964FF" } });

export type RedeemInviteRequest = z.infer<typeof redeemInviteRequestSchema>;

// 초대한 친구 목록도 친구 목록과 같은 cursor(마지막 userId)·limit 규칙을 쓴다
export const getInvitedFriendsQuerySchema = getFollowsQuerySchema.extend({
  status: redemptionStatusSchema
    .optional()
    .describe("초대 수락 상태로 거르기 (예: JOINED는 사용 시작을 기다리는 친구, 생략하면 전체)"),
});

export type GetInvitedFriendsQuery = z.infer<typeof getInvitedFriendsQuerySchema>;
