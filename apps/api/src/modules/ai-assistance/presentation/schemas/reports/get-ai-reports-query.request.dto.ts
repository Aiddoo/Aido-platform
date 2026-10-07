import { getAiReportsQuerySchema } from "@aido/api";
import type { z } from "zod";

export const GetAiReportsQueryDto = getAiReportsQuerySchema.meta({
  id: "GetAiReportsQueryDto",
  apiParameter: true,
});
export type GetAiReportsQueryDto = z.infer<typeof GetAiReportsQueryDto>;
