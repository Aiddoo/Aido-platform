import { reorderTodoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ReorderTodoDto extends createZodDto(reorderTodoSchema) {}
