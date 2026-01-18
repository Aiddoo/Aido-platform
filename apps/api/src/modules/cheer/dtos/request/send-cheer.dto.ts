import {
	createCheerSchema,
	markCheerReadSchema,
	markCheersReadSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class SendCheerDto extends createZodDto(createCheerSchema) {}

export class MarkCheerReadDto extends createZodDto(markCheerReadSchema) {}

export class MarkCheersReadDto extends createZodDto(markCheersReadSchema) {}
