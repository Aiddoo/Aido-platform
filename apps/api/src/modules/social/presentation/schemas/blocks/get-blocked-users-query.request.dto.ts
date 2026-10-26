import { getBlockedUsersQuerySchema } from "@aido/api";
import type { z } from "zod";

export const GetBlockedUsersQueryDto = getBlockedUsersQuerySchema.meta({
  id: "GetBlockedUsersQueryDto",
  apiParameter: true,
});
export type GetBlockedUsersQueryDto = z.infer<typeof GetBlockedUsersQueryDto>;
