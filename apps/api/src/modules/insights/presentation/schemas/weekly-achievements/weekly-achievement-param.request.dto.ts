import { weeklyAchievementParamSchema } from "@aido/api";
import type { z } from "zod";

export const WeeklyAchievementParamDto = weeklyAchievementParamSchema.meta({
  id: "WeeklyAchievementParamDto",
  apiParameter: true,
});
export type WeeklyAchievementParamDto = z.infer<typeof WeeklyAchievementParamDto>;
