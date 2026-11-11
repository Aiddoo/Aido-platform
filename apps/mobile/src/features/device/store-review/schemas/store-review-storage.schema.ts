import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { storeReviewStateSchema } from '../domains/store-review.model';

/** 기기에 쓰는 모양. 앱 모양과 칸이 같고 버전만 붙는다. 디스크 형식은 바꾸지 않는다 */
export const storeReviewStorageSchema = storeReviewStateSchema.extend({
  version: z.literal(2),
});

/** 앱 안 확인 창을 쓰던 이전 저장 모양. 읽는 즉시 새 모양으로 옮겨 쓴다 */
export const legacyStoreReviewStorageSchema = z.object({
  completions: z.array(z.object({ localDate: dateKeySchema })),
  reviewRequestedAt: instantSchema.nullable(),
});
export type LegacyStoreReviewStorage = z.infer<typeof legacyStoreReviewStorageSchema>;
