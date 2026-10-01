import { createInquiryResponseSchema } from "@aido/validators";
import type { z } from "zod";

export const CreateInquiryResponseDto = createInquiryResponseSchema.meta({
	id: "CreateInquiryResponseDto",
});
export type CreateInquiryResponseDto = z.infer<typeof CreateInquiryResponseDto>;
