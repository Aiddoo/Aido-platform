import { aiReportIdParamSchema } from "@aido/validators";
import type { z } from "zod";

export const AiReportIdParamDto = aiReportIdParamSchema.meta({
	id: "AiReportIdParamDto",
	apiParameter: true,
});
export type AiReportIdParamDto = z.infer<typeof AiReportIdParamDto>;
