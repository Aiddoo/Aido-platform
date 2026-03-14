import {
	createNudgeSchema,
	createRemindNudgeSchema,
	markNudgeReadSchema,
	markNudgesReadSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class SendNudgeDto extends createZodDto(createNudgeSchema) {}

export class SendRemindNudgeDto extends createZodDto(createRemindNudgeSchema) {}

export class MarkNudgeReadDto extends createZodDto(markNudgeReadSchema) {}

export class MarkNudgesReadDto extends createZodDto(markNudgesReadSchema) {}
