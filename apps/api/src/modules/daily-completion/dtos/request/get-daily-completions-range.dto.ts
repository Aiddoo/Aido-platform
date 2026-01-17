import { getDailyCompletionsRangeSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetDailyCompletionsRangeDto extends createZodDto(
	getDailyCompletionsRangeSchema,
) {}
