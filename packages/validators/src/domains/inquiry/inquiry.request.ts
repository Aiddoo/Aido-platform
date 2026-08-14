import { z } from 'zod';

import { INQUIRY_CATEGORY, INQUIRY_CONTENT_LIMITS } from './inquiry.constants';

export const createInquirySchema = z
  .object({
    category: z.enum(INQUIRY_CATEGORY).describe('문의 카테고리'),
    content: z
      .string()
      .min(
        INQUIRY_CONTENT_LIMITS.MIN_LENGTH,
        `내용은 최소 ${INQUIRY_CONTENT_LIMITS.MIN_LENGTH}자 이상이어야 합니다`,
      )
      .max(
        INQUIRY_CONTENT_LIMITS.MAX_LENGTH,
        `내용은 최대 ${INQUIRY_CONTENT_LIMITS.MAX_LENGTH}자 이하여야 합니다`,
      )
      .describe('문의 내용'),
  })
  .meta({
    example: {
      category: 'BUG_REPORT',
      content: '앱에서 할 일 추가 시 가끔 오류가 발생합니다.',
    },
  });

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
