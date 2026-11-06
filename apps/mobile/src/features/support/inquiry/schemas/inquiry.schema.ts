import { createInquiryResponseSchema } from '@aido/api';
import type { z } from 'zod';

export const inquiryResultSchema = createInquiryResponseSchema.pick({ message: true });
export type InquiryResult = z.infer<typeof inquiryResultSchema>;
