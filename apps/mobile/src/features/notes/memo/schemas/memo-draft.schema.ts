import { z } from 'zod';

import { memoSchema } from '../domains/memo.model';

/** 초안에는 한도를 두지 않는다. 입력 중인 글자를 잃지 않게 저장할 때만 검사한다 */
export const memoDraftSchema = memoSchema.pick({ content: true });

/** 응답을 받지 못한 새 메모 저장의 키. 같은 글을 다시 저장할 때만 같은 키를 보낸다 */
export const memoCreateRequestDraftSchema = memoSchema
  .pick({ content: true })
  .extend({ idempotencyKey: z.string() });

export const memoPlanRequestDraftSchema = z.object({
  fingerprint: z.string(),
  idempotencyKey: z.string(),
  input: memoSchema.pick({ content: true }).extend({ categoryId: z.int() }),
});
