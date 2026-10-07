import { friendRequestUserSchema, friendUserSchema } from "@aido/validators";
import type { z } from "zod";

export const FriendUserResponseDto = friendUserSchema.meta({ id: "FriendUserResponseDto" });
export type FriendUserResponseDto = z.infer<typeof FriendUserResponseDto>;

export const FriendRequestUserResponseDto = friendRequestUserSchema.meta({
  id: "FriendRequestUserResponseDto",
});
export type FriendRequestUserResponseDto = z.infer<typeof FriendRequestUserResponseDto>;
