import { createTodoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CreateTodoDto extends createZodDto(createTodoSchema) {}
