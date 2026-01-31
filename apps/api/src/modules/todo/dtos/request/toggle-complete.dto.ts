import { toggleTodoCompleteSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ToggleTodoCompleteDto extends createZodDto(
	toggleTodoCompleteSchema,
) {}
