import { createInquirySchema } from '@aido/api';
import { z } from 'zod';

/** 서버 규칙(길이 10~2000)을 그대로 쓰되 앞뒤 공백을 뺀 글자로 센다. 공백만 있는 문의는 보내지 않는다 */
export const inquiryFormSchema = createInquirySchema.extend({
  content: z.string().trim().pipe(createInquirySchema.shape.content),
});
export type InquiryRequestValues = z.output<typeof inquiryFormSchema>;
