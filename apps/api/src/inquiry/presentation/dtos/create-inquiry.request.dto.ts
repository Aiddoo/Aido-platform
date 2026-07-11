import { createInquirySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CreateInquiryDto extends createZodDto(createInquirySchema) {}
