import { createInquirySchema } from "@aido/validators";
import type { z } from "zod";

export const CreateInquiryDto = createInquirySchema.meta({ id: "CreateInquiryDto" });
export type CreateInquiryDto = z.infer<typeof CreateInquiryDto>;
