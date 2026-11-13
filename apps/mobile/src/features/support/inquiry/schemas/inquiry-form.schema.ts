import { createInquirySchema } from '@aido/api';
import { trimmed } from '@src/shared/schemas/trimmed.schema';
import type { z } from 'zod';

/** 서버 규칙(길이 10~2000)을 그대로 쓰되 앞뒤 공백을 뺀 글자로 센다. 공백만 있는 문의는 보내지 않는다 */
export const inquiryFormSchema = createInquirySchema.extend({
  content: trimmed(createInquirySchema.shape.content),
});
export type InquiryFormValues = z.output<typeof inquiryFormSchema>;
