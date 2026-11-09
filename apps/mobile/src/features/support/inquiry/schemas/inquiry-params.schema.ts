import { INQUIRY_CATEGORY, INQUIRY_CONTENT_LIMITS } from '@aido/api';
import { z } from 'zod';

export const inquiryParamsSchema = z.object({
  category: z.enum(INQUIRY_CATEGORY).catch(INQUIRY_CATEGORY.BUG_REPORT),
  content: z.string().max(INQUIRY_CONTENT_LIMITS.MAX_LENGTH).catch(''),
});
