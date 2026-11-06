import { z } from 'zod';

import { memoSchema } from './memo.schema';

/** 초안에는 한도를 두지 않는다. 입력 중인 글자를 잃지 않게 저장할 때만 검사한다 */
export const memoDraftSchema = memoSchema.pick({ content: true });

export const memoPlanRequestDraftSchema = z.object({
  fingerprint: z.string(),
  idempotencyKey: z.string(),
  input: memoSchema.pick({ content: true }).extend({ categoryId: z.int() }),
});
