import { z } from 'zod';

export const inquiryResultSchema = z.object({
  message: z.string(),
});

export type InquiryResult = z.infer<typeof inquiryResultSchema>;
