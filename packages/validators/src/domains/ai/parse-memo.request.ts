import { z } from 'zod';

import { MEMO_LIMITS } from '../memo/memo.constants';

export const parseMemoRequestSchema = z.object({
  content: z
    .string()
    .min(1, '메모 내용을 입력해주세요')
    .max(
      MEMO_LIMITS.MAX_CONTENT_LENGTH,
      `메모는 ${MEMO_LIMITS.MAX_CONTENT_LENGTH}자 이내여야 합니다`,
    )
    .describe(`AI로 파싱할 메모 내용 (1-${MEMO_LIMITS.MAX_CONTENT_LENGTH}자)`),
  categoryId: z
    .number()
    .int()
    .positive('유효하지 않은 카테고리 ID입니다')
    .describe('기본 카테고리 ID (생성될 모든 할 일에 적용)'),
});

export type ParseMemoRequest = z.infer<typeof parseMemoRequestSchema>;
