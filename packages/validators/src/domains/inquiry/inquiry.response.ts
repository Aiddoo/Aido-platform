import { z } from 'zod';

export const createInquiryResponseSchema = z
  .object({
    message: z.string().describe('처리 결과 메시지'),
  })
  .meta({
    example: {
      message: '문의가 접수되었습니다.',
    },
  });

export type CreateInquiryResponse = z.infer<typeof createInquiryResponseSchema>;
