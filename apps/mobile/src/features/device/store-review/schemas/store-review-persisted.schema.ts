import { dateSchema } from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { storeReviewStateSchema } from './store-review.schema';

/** 기기에 쓰는 모양. 앱 모양과 칸이 같고 버전만 붙는다. 디스크 형식은 바꾸지 않는다 */
export const persistedStoreReviewStateSchema = storeReviewStateSchema.extend({
  version: z.literal(2),
});

/** 앱 안 확인 창을 쓰던 이전 저장 모양. 읽는 즉시 새 모양으로 옮겨 쓴다 */
export const legacyStoreReviewStateSchema = z.object({
  completions: z.array(z.object({ localDate: dateSchema })),
  reviewRequestedAt: instantSchema.nullable(),
});
export type LegacyStoreReviewState = z.infer<typeof legacyStoreReviewStateSchema>;
