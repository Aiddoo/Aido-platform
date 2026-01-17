import {
	dailyCompletionSummarySchema,
	dailyCompletionsRangeResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class DailyCompletionSummaryDto extends createZodDto(
	dailyCompletionSummarySchema,
) {}

export class DailyCompletionsRangeResponseDto extends createZodDto(
	dailyCompletionsRangeResponseSchema,
) {}
