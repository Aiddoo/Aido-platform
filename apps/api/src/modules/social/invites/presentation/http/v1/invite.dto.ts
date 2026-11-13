import {
  inviteAvailabilityResponseSchema,
  inviteCodeParamSchema,
  invitePreviewResponseSchema,
  myInviteResponseSchema,
} from "@aido/api";
import type { z } from "zod";

export const InviteCodeParamDto = inviteCodeParamSchema.meta({
  id: "InviteCodeParamDto",
  apiParameter: true,
});
export type InviteCodeParamDto = z.infer<typeof InviteCodeParamDto>;

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
