import { getDailyCompletionsRangeSchema } from "@aido/validators";
import type { z } from "zod";

export const GetDailyCompletionsRangeDto = getDailyCompletionsRangeSchema.meta({
  id: "GetDailyCompletionsRangeDto",
  apiParameter: true,
});
export type GetDailyCompletionsRangeDto = z.infer<typeof GetDailyCompletionsRangeDto>;
