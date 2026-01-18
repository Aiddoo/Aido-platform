import {
	nudgeDetailSchema,
	receivedNudgesResponseSchema,
	sentNudgesResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class NudgeDetailDto extends createZodDto(nudgeDetailSchema) {}

export class ReceivedNudgesResponseDto extends createZodDto(
	receivedNudgesResponseSchema,
) {}

export class SentNudgesResponseDto extends createZodDto(
	sentNudgesResponseSchema,
) {}
