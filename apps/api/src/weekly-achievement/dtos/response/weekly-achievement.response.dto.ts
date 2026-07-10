import {
	weeklyAchievementDetailResponseSchema,
	weeklyAchievementListResponseSchema,
	weeklyAchievementSchema,
	weeklyAchievementSummarySchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class WeeklyAchievementDto extends createZodDto(
	weeklyAchievementSchema,
) {}

export class WeeklyAchievementSummaryDto extends createZodDto(
	weeklyAchievementSummarySchema,
) {}

export class WeeklyAchievementListResponseDto extends createZodDto(
	weeklyAchievementListResponseSchema,
) {}

export class WeeklyAchievementDetailResponseDto extends createZodDto(
	weeklyAchievementDetailResponseSchema,
) {}
