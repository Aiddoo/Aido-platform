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
