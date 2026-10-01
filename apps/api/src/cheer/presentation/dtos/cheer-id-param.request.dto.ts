import { cheerIdParamSchema } from "@aido/validators";
import type { z } from "zod";

export const CheerIdParamDto = cheerIdParamSchema.meta({
	id: "CheerIdParamDto",
	apiParameter: true,
});
export type CheerIdParamDto = z.infer<typeof CheerIdParamDto>;
