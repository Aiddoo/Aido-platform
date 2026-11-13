import {
  getInvitedFriendsQuerySchema,
  inviteCodeParamSchema,
  invitedFriendsListResponseSchema,
  redeemInviteRequestSchema,
  redeemInviteResponseSchema,
} from "@aido/api";
import type { RedemptionRejectionReason, RedemptionStatus } from "@aido/api/vocabulary";
import type { z } from "zod";

export const GetInvitedFriendsQueryDto = getInvitedFriendsQuerySchema.meta({
  id: "GetInvitedFriendsQueryDto",
  apiParameter: true,
});
export type GetInvitedFriendsQueryDto = z.infer<typeof GetInvitedFriendsQueryDto>;

// 경로 파라미터라 component로 싣지 않는다. 미리보기 경로의 InviteCodeParamDto와 같은 schema다
export const RedeemInviteCodeParamDto = inviteCodeParamSchema.meta({
  id: "RedeemInviteCodeParamDto",
  apiParameter: true,
});
export type RedeemInviteCodeParamDto = z.infer<typeof RedeemInviteCodeParamDto>;

export const RedeemInviteDto = redeemInviteRequestSchema.meta({ id: "RedeemInviteDto" });
export type RedeemInviteDto = z.infer<typeof RedeemInviteDto>;

export const InvitedFriendsListResponseDto = invitedFriendsListResponseSchema.meta({
  id: "InvitedFriendsListResponseDto",
});
type InvitedFriendsListResponse = z.infer<typeof InvitedFriendsListResponseDto>;
type InvitedFriendResponse = InvitedFriendsListResponse["items"][number];

// 서버는 정의된 상태·사유만 보낸다. 응답 스키마의 UNKNOWN·null fallback은 구버전 앱의 파싱용이라
// 서버 응답 타입은 엄격한 값으로 좁힌다
export type InvitedFriendsListResponseDto = Omit<InvitedFriendsListResponse, "items"> & {
  readonly items: (Omit<InvitedFriendResponse, "status" | "rejectionReason"> & {
    readonly status: RedemptionStatus;
    readonly rejectionReason: RedemptionRejectionReason | null;
  })[];
};

export const RedeemInviteResponseDto = redeemInviteResponseSchema.meta({
  id: "RedeemInviteResponseDto",
});
export type RedeemInviteResponseDto = z.infer<typeof RedeemInviteResponseDto>;
