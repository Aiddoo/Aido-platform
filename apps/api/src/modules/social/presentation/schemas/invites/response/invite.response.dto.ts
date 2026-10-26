import {
  inviteAvailabilityResponseSchema,
  invitedFriendsListResponseSchema,
  invitePreviewResponseSchema,
  myInviteResponseSchema,
  redeemInviteResponseSchema,
} from "@aido/api";
import type { RedemptionRejectionReason, RedemptionStatus } from "@aido/api/vocabulary";
import type { z } from "zod";

export const InviteAvailabilityResponseDto = inviteAvailabilityResponseSchema.meta({
  id: "InviteAvailabilityResponseDto",
});
export type InviteAvailabilityResponseDto = z.infer<typeof InviteAvailabilityResponseDto>;

export const MyInviteResponseDto = myInviteResponseSchema.meta({ id: "MyInviteResponseDto" });
export type MyInviteResponseDto = z.infer<typeof MyInviteResponseDto>;

export const InvitePreviewResponseDto = invitePreviewResponseSchema.meta({
  id: "InvitePreviewResponseDto",
});
export type InvitePreviewResponseDto = z.infer<typeof InvitePreviewResponseDto>;

export const InvitedFriendsListResponseDto = invitedFriendsListResponseSchema.meta({
  id: "InvitedFriendsListResponseDto",
});
type InvitedFriendsListResponse = z.infer<typeof InvitedFriendsListResponseDto>;
type InvitedFriendResponse = InvitedFriendsListResponse["items"][number];

/**
 * 서버는 정의된 상태·사유만 보낸다. 응답 스키마의 UNKNOWN·null fallback은 구버전 앱의 파싱용이라
 * 서버 응답 타입은 엄격한 값으로 좁힌다.
 */
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
