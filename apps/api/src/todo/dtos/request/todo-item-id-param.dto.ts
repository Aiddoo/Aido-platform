import { todoItemIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoItemIdParamDto extends createZodDto(todoItemIdParamSchema) {}
