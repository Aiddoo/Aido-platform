import { changeTodoCategorySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ChangeTodoCategoryDto extends createZodDto(
	changeTodoCategorySchema,
) {}
