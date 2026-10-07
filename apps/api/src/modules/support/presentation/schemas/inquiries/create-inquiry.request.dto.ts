import { createInquirySchema } from "@aido/api";
import type { z } from "zod";

export const CreateInquiryDto = createInquirySchema.meta({ id: "CreateInquiryDto" });
export type CreateInquiryDto = z.infer<typeof CreateInquiryDto>;
