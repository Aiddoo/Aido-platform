import { getTodosQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetTodosQueryDto extends createZodDto(getTodosQuerySchema) {}
