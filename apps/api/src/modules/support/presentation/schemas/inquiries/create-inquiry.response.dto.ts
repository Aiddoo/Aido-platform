import { createInquiryResponseSchema } from "@aido/api";
import type { z } from "zod";

export const CreateInquiryResponseDto = createInquiryResponseSchema.meta({
  id: "CreateInquiryResponseDto",
});
export type CreateInquiryResponseDto = z.infer<typeof CreateInquiryResponseDto>;
