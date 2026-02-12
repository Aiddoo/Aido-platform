import { createInquiryResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CreateInquiryResponseDto extends createZodDto(
	createInquiryResponseSchema,
) {}
