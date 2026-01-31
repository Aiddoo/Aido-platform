import { todoIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoIdParamDto extends createZodDto(todoIdParamSchema) {}
