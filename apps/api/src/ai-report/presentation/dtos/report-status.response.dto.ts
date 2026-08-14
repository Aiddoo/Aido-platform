import { reportStatusResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ReportStatusResponseDto extends createZodDto(reportStatusResponseSchema) {}
