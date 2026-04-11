import { updateTodoTitleSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateTodoTitleDto extends createZodDto(updateTodoTitleSchema) {}
