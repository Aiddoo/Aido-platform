import { createInquiryResponseSchema, createInquirySchema } from "@aido/api/contracts/inquiry";
import type { z } from "zod";

export const CreateInquiryDto = createInquirySchema.meta({ id: "CreateInquiryDto" });
export type CreateInquiryDto = z.infer<typeof CreateInquiryDto>;

export const CreateInquiryResponseDto = createInquiryResponseSchema.meta({
  id: "CreateInquiryResponseDto",
});
export type CreateInquiryResponseDto = z.infer<typeof CreateInquiryResponseDto>;
