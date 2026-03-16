import { nudgeIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class NudgeIdParamDto extends createZodDto(nudgeIdParamSchema) {}
