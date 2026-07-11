import { updateTodoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoDto extends createZodDto(updateTodoSchema) {}
