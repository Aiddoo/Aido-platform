import { todoCategoryIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoCategoryIdParamDto extends createZodDto(
	todoCategoryIdParamSchema,
) {}
