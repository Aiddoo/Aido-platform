import { createTodoItemSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CreateTodoItemDto extends createZodDto(createTodoItemSchema) {}
