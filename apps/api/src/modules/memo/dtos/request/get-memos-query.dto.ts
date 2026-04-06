import { getMemosQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetMemosQueryDto extends createZodDto(getMemosQuerySchema) {}
