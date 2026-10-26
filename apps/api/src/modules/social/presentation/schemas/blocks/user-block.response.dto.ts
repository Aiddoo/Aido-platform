import {
  blockedUsersResponseSchema,
  blockUserResponseSchema,
  unblockUserResponseSchema,
} from "@aido/api";
import type { z } from "zod";

export const BlockUserResponseDto = blockUserResponseSchema.meta({ id: "BlockUserResponseDto" });
export type BlockUserResponseDto = z.infer<typeof BlockUserResponseDto>;
export const UnblockUserResponseDto = unblockUserResponseSchema.meta({
  id: "UnblockUserResponseDto",
});
export type UnblockUserResponseDto = z.infer<typeof UnblockUserResponseDto>;
export const BlockedUsersResponseDto = blockedUsersResponseSchema.meta({
  id: "BlockedUsersResponseDto",
});
export type BlockedUsersResponseDto = z.infer<typeof BlockedUsersResponseDto>;
