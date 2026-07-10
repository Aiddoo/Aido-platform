import { updateTodoItemSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoItemDto extends createZodDto(updateTodoItemSchema) {}
