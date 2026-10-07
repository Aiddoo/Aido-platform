import { getFollowsQuerySchema, getFriendsQuerySchema } from "@aido/validators";
import type { z } from "zod";

export const GetFollowsQueryDto = getFollowsQuerySchema.meta({
  id: "GetFollowsQueryDto",
  apiParameter: true,
});
export type GetFollowsQueryDto = z.infer<typeof GetFollowsQueryDto>;
export const GetFriendsQueryDto = getFriendsQuerySchema.meta({
  id: "GetFriendsQueryDto",
  apiParameter: true,
});
export type GetFriendsQueryDto = z.infer<typeof GetFriendsQueryDto>;
