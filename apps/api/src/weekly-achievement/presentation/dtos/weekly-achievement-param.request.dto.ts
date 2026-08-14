import { weeklyAchievementParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class WeeklyAchievementParamDto extends createZodDto(weeklyAchievementParamSchema) {}
