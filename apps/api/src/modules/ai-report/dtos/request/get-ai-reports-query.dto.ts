import { getAiReportsQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetAiReportsQueryDto extends createZodDto(
	getAiReportsQuerySchema,
) {}
