import {
  getBlockedUsersQuerySchema,
  blockedUsersResponseSchema,
  blockUserResponseSchema,
  unblockUserResponseSchema,
} from "@aido/api/contracts/user-block";
import type { z } from "zod";

export const GetBlockedUsersQueryDto = getBlockedUsersQuerySchema.meta({
  id: "GetBlockedUsersQueryDto",
  apiParameter: true,
});
export type GetBlockedUsersQueryDto = z.infer<typeof GetBlockedUsersQueryDto>;

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
