import { getWeeklyAchievementsQuerySchema } from "@aido/api";
import type { z } from "zod";

export const GetWeeklyAchievementsQueryDto = getWeeklyAchievementsQuerySchema.meta({
  id: "GetWeeklyAchievementsQueryDto",
  apiParameter: true,
});
export type GetWeeklyAchievementsQueryDto = z.infer<typeof GetWeeklyAchievementsQueryDto>;
