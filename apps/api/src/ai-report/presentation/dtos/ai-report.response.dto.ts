import { aiReportListResponseSchema, aiReportResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class AiReportResponseDto extends createZodDto(aiReportResponseSchema) {}
export class AiReportListResponseDto extends createZodDto(aiReportListResponseSchema) {}
