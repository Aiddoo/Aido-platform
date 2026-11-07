import { z } from 'zod';

/** 서버 에러 envelope은 신뢰할 수 없는 입력이라 런타임에 검증한다 */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
