import {
  inviteAvailabilityResponseSchema,
  invitedFriendsListResponseSchema,
  invitePreviewResponseSchema,
  myInviteResponseSchema,
} from "@aido/api";
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
export type InvitedFriendsListResponseDto = z.infer<typeof InvitedFriendsListResponseDto>;
