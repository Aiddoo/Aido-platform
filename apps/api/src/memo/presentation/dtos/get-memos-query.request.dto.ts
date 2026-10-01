import { getMemosQuerySchema } from "@aido/validators";
import type { z } from "zod";

export const GetMemosQueryDto = getMemosQuerySchema.meta({
	id: "GetMemosQueryDto",
	apiParameter: true,
});
export type GetMemosQueryDto = z.infer<typeof GetMemosQueryDto>;
