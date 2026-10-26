import { getInvitedFriendsQuerySchema } from "@aido/api";
import type { z } from "zod";

export const GetInvitedFriendsQueryDto = getInvitedFriendsQuerySchema.meta({
  id: "GetInvitedFriendsQueryDto",
  apiParameter: true,
});
export type GetInvitedFriendsQueryDto = z.infer<typeof GetInvitedFriendsQueryDto>;
