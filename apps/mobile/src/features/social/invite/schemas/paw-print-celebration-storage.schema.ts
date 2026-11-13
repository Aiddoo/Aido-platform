import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

/** 찍히는 애니메이션을 이미 본 발자국 수. 계정마다 따로 두어 같은 기기 다른 계정과 섞이지 않는다 */
export const pawPrintCelebrationStoredValue = defineStoredValue({
  key: (userId: string) => `aido_invite_paw_print_celebrated_v1:${userId}`,
  schema: storedJsonSchema(z.int().nonnegative()),
  fallback: 0,
});
