import { createTodoCategorySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CreateTodoCategoryDto extends createZodDto(
	createTodoCategorySchema,
) {}
