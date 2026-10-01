import { userIdParamSchema } from "@aido/validators";
import type { z } from "zod";

export const UserIdParamDto = userIdParamSchema.meta({ id: "UserIdParamDto", apiParameter: true });
export type UserIdParamDto = z.infer<typeof UserIdParamDto>;
