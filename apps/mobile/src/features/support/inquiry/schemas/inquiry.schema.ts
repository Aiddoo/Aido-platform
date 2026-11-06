import { createInquiryResponseSchema } from '@aido/api';
import type { z } from 'zod';

const inquiryResultSchema = createInquiryResponseSchema.pick({ message: true });
export type InquiryResult = z.infer<typeof inquiryResultSchema>;
