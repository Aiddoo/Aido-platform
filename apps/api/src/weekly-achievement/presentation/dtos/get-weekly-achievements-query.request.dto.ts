import { getWeeklyAchievementsQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetWeeklyAchievementsQueryDto extends createZodDto(getWeeklyAchievementsQuerySchema) {}
