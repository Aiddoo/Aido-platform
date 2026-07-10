import { createRecurringTodoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CreateRecurringTodoDto extends createZodDto(
	createRecurringTodoSchema,
) {}
