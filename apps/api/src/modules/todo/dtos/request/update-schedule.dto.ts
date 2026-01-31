import { updateTodoScheduleSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoScheduleDto extends createZodDto(
	updateTodoScheduleSchema,
) {}
