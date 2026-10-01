import { nudgeIdParamSchema } from "@aido/validators";
import type { z } from "zod";

export const NudgeIdParamDto = nudgeIdParamSchema.meta({
	id: "NudgeIdParamDto",
	apiParameter: true,
});
export type NudgeIdParamDto = z.infer<typeof NudgeIdParamDto>;
