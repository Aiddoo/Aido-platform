import { reorderMemoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ReorderMemoDto extends createZodDto(reorderMemoSchema) {}
