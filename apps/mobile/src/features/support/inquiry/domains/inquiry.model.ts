import { z } from 'zod';

const inquiryResultSchema = z.object({
  message: z.string(),
});
export type InquiryResult = z.infer<typeof inquiryResultSchema>;
