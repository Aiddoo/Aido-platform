import { cheerIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CheerIdParamDto extends createZodDto(cheerIdParamSchema) {}
