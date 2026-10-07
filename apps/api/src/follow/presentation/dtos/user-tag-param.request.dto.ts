import { sendFriendRequestParamSchema } from "@aido/validators";
import type { z } from "zod";

export const UserTagParamDto = sendFriendRequestParamSchema.meta({
  id: "UserTagParamDto",
  apiParameter: true,
});
export type UserTagParamDto = z.infer<typeof UserTagParamDto>;
