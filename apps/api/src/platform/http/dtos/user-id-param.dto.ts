import { userIdParamSchema } from "@aido/api/contracts/follow/v1";
import type { z } from "zod";

export const UserIdParamDto = userIdParamSchema.meta({ id: "UserIdParamDto", apiParameter: true });
export type UserIdParamDto = z.infer<typeof UserIdParamDto>;
