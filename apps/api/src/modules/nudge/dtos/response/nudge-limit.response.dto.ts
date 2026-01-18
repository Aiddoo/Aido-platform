import {
	createNudgeResponseSchema,
	markNudgeReadResponseSchema,
	nudgeLimitInfoSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class NudgeLimitInfoDto extends createZodDto(nudgeLimitInfoSchema) {}

export class CreateNudgeResponseDto extends createZodDto(
	createNudgeResponseSchema,
) {}

export class MarkNudgeReadResponseDto extends createZodDto(
	markNudgeReadResponseSchema,
) {}
