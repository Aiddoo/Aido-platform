import { getWeeklyAchievementsQuerySchema } from "@aido/validators";
import type { z } from "zod";

export const GetWeeklyAchievementsQueryDto = getWeeklyAchievementsQuerySchema.meta({
	id: "GetWeeklyAchievementsQueryDto",
	apiParameter: true,
});
export type GetWeeklyAchievementsQueryDto = z.infer<typeof GetWeeklyAchievementsQueryDto>;
