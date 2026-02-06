import { getNudgesQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetNudgesQueryDto extends createZodDto(getNudgesQuerySchema) {}
