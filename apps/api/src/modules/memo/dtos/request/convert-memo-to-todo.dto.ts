import { convertMemoToTodoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ConvertMemoToTodoDto extends createZodDto(
	convertMemoToTodoSchema,
) {}
