import { updateTodoContentSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoContentDto extends createZodDto(
	updateTodoContentSchema,
) {}
