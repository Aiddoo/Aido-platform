import { convertMemoToTodosSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ConvertMemoToTodosDto extends createZodDto(
	convertMemoToTodosSchema,
) {}
