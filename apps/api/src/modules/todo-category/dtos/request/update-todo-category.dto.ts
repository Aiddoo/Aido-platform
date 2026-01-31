import { updateTodoCategorySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoCategoryDto extends createZodDto(
	updateTodoCategorySchema,
) {}
