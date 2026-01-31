import { markReadResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class MarkReadResponseDto extends createZodDto(markReadResponseSchema) {}
