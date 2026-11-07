import { dateSchema } from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import {
  STORE_REVIEW_MIN_ACTIVE_DAYS,
  STORE_REVIEW_MAX_REQUESTS_PER_WINDOW,
  STORE_REVIEW_MOMENTS,
} from '../constants/store-review.constants';

const storeReviewMomentSchema = z.enum(STORE_REVIEW_MOMENTS);
export type StoreReviewMoment = z.infer<typeof storeReviewMomentSchema>;

/** 앱이 쓰는 모양. 요청 시각은 Date가 아니라 Instant 그대로 둔다 */
export const storeReviewStateSchema = z.object({
  activeDays: z.array(dateSchema).max(STORE_REVIEW_MIN_ACTIVE_DAYS),
  requestedAt: z.array(instantSchema).max(STORE_REVIEW_MAX_REQUESTS_PER_WINDOW),
});
export type StoreReviewState = z.infer<typeof storeReviewStateSchema>;

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
