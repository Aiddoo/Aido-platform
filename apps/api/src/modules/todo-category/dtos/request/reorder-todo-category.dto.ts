import { reorderTodoCategorySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ReorderTodoCategoryDto extends createZodDto(
	reorderTodoCategorySchema,
) {}
