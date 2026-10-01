import { getNudgesQuerySchema } from "@aido/validators";
import type { z } from "zod";

export const GetNudgesQueryDto = getNudgesQuerySchema.meta({
	id: "GetNudgesQueryDto",
	apiParameter: true,
});
export type GetNudgesQueryDto = z.infer<typeof GetNudgesQueryDto>;
