import { updateTodoVisibilitySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoVisibilityDto extends createZodDto(
	updateTodoVisibilitySchema,
) {}
