import { todoResourceLimitQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class TodoResourceLimitQueryDto extends createZodDto(todoResourceLimitQuerySchema) {}
