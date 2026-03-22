import { reorderTodoItemsSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ReorderTodoItemsDto extends createZodDto(reorderTodoItemsSchema) {}
