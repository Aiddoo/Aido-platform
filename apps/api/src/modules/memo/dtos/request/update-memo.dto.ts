import { updateMemoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdateMemoDto extends createZodDto(updateMemoSchema) {}
