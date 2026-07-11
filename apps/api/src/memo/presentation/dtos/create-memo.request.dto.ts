import { createMemoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CreateMemoDto extends createZodDto(createMemoSchema) {}
