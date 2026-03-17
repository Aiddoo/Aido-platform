import { aiReportIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class AiReportIdParamDto extends createZodDto(aiReportIdParamSchema) {}
